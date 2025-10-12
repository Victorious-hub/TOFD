import "dotenv/config";

import BN from "bn.js";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  CurveCalculator,
  DEVNET_PROGRAM_ID,
  FeeOn,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { readFileSync } from "fs";
import { resolve as resolvePath } from "path";

const commitment = (process.env.SOLANA_COMMITMENT ?? "confirmed") as Commitment;
const endpoint = process.env.SOLANA_RPC ?? clusterApiUrl("devnet");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function loadKeypair(): Keypair {
  if (process.env.PAYER_SECRET) {
    return Keypair.fromSecretKey(bs58.decode(requireEnv("PAYER_SECRET")));
  }
  const path = process.env.PAYER_KEYPAIR_PATH ?? "../../Lab2/wallet.json";
  const resolved = resolvePath(process.cwd(), path);
  const secret = readFileSync(resolved, "utf-8").trim();
  return Keypair.fromSecretKey(bs58.decode(secret));
}

function parseSlippageBps(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid slippage value (expected basis points integer): ${raw}`);
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0 || value > 5000) {
    throw new Error("Slippage must be between 0 and 5000 basis points (0%-50%)");
  }
  return value;
}

function parseAmount(raw: string, decimals: number): BN {
  const [wholeRaw, fractionRaw = ""] = raw.split(".");
  const whole = wholeRaw ?? "0";
  const fraction = fractionRaw ?? "";
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error(`Invalid amount format: ${raw}`);
  }
  if (fraction.length > decimals) {
    throw new Error(
      `Amount ${raw} has more fractional digits than the mint decimals (${decimals})`,
    );
  }
  const paddedFraction = fraction.padEnd(decimals, "0");
  const combined = `${whole}${paddedFraction}`.replace(/^0+/, "");
  return new BN(combined === "" ? "0" : combined, 10);
}

function formatAmount(amount: BN, decimals: number): string {
  if (amount.isZero()) {
    return "0";
  }
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = amount.div(divisor).toString(10);
  const fraction = amount.mod(divisor).toString(10).padStart(decimals, "0");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction.length > 0 ? `${whole}.${trimmedFraction}` : whole;
}

type SwapDirection = "token-to-wsol" | "wsol-to-token";

function parseDirection(raw: string | undefined): SwapDirection {
  const normalized = (raw ?? "token-to-wsol").toLowerCase();
  if (normalized === "token-to-wsol" || normalized === "token_to_wsol") {
    return "token-to-wsol";
  }
  if (normalized === "wsol-to-token" || normalized === "wsol_to_token") {
    return "wsol-to-token";
  }
  throw new Error(`Unsupported SWAP_DIRECTION: ${raw}`);
}

function computeCreatorFeeFlag(feeOn: number, baseIn: boolean): boolean {
  switch (feeOn) {
    case FeeOn.BothToken:
      return true;
    case FeeOn.OnlyTokenA:
      return !baseIn;
    case FeeOn.OnlyTokenB:
      return baseIn;
    default:
      return false;
  }
}

async function main() {
  const payer = loadKeypair();
  const connection = new Connection(endpoint, commitment);

  const raydium = await Raydium.load({
    connection,
    owner: payer,
    cluster: "devnet",
    disableLoadToken: false,
    blockhashCommitment: commitment,
  });

  const poolIdRaw = process.env.SWAP_POOL_ID ?? "n31RfhgF7z2jbUbyrF2NdT451rvPZr1p36StiXRkWFQ";
  const poolId = new PublicKey(poolIdRaw).toBase58();

  const direction = parseDirection(process.env.SWAP_DIRECTION);
  const swapAmountRaw = process.argv[2] ?? process.env.SWAP_AMOUNT ?? "1";
  const slippageBps = parseSlippageBps(process.env.SWAP_SLIPPAGE_BPS ?? "50");
  const slippageDecimal = slippageBps / 10000;

  const tokenMint = new PublicKey(requireEnv("TOKEN_MINT_ADDRESS"));
  const { poolInfo, poolKeys, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId);

  const mintA = new PublicKey(poolInfo.mintA.address);
  const mintB = new PublicKey(poolInfo.mintB.address);

  const inputMint = direction === "token-to-wsol" ? tokenMint : NATIVE_MINT;
  const outputMint = direction === "token-to-wsol" ? NATIVE_MINT : tokenMint;

  if (!mintA.equals(inputMint) && !mintB.equals(inputMint)) {
    throw new Error("Input mint not found in target pool");
  }
  if (!mintA.equals(outputMint) && !mintB.equals(outputMint)) {
    throw new Error("Output mint not found in target pool");
  }

  const baseIn = mintA.equals(inputMint);
  const inputDecimals = baseIn ? poolInfo.mintA.decimals : poolInfo.mintB.decimals;
  const outputDecimals = baseIn ? poolInfo.mintB.decimals : poolInfo.mintA.decimals;

  const amountIn = parseAmount(swapAmountRaw, inputDecimals);
  if (amountIn.isZero()) {
    throw new Error("Swap amount must be greater than zero");
  }

  const reservesIn = baseIn ? rpcData.baseReserve : rpcData.quoteReserve;
  const reservesOut = baseIn ? rpcData.quoteReserve : rpcData.baseReserve;
  const config = rpcData.configInfo;
  if (!config) {
    throw new Error("Pool configuration not available");
  }

  const isCreatorFeeOnInput = computeCreatorFeeFlag(rpcData.feeOn, baseIn);
  const swapComputation = CurveCalculator.swapBaseInput(
    amountIn,
    reservesIn,
    reservesOut,
    config.tradeFeeRate,
    config.creatorFeeRate,
    config.protocolFeeRate,
    config.fundFeeRate,
    isCreatorFeeOnInput,
  );

  const minOut = swapComputation.outputAmount.mul(new BN(10000 - slippageBps)).div(new BN(10000));

  console.log("Preparing Raydium CPMM swap:");
  console.log("  Pool:", poolId);
  console.log("  Direction:", direction);
  console.log("  Input:", inputMint.toBase58(), `${formatAmount(amountIn, inputDecimals)} (${amountIn.toString(10)} raw)`);
  console.log(
    "  Expected output:",
    outputMint.toBase58(),
    `${formatAmount(swapComputation.outputAmount, outputDecimals)} (${swapComputation.outputAmount.toString(10)} raw)`,
  );
  console.log(
    "  Minimum output (after slippage):",
    `${formatAmount(minOut, outputDecimals)} (${minOut.toString(10)} raw)`,
  );

  const tx = await raydium.cpmm.swap({
    poolInfo,
    poolKeys,
    baseIn,
    inputAmount: amountIn,
    swapResult: {
      inputAmount: swapComputation.inputAmount,
      outputAmount: swapComputation.outputAmount,
    },
    slippage: slippageDecimal,
    feePayer: payer.publicKey,
  });

  const { txId } = await tx.execute({ skipPreflight: false });
  console.log("Swap signature:", txId);
}

main().catch((error) => {
  console.error("Failed to execute Raydium swap:", error);
  process.exit(1);
});