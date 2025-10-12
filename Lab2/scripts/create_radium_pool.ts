import "dotenv/config";

import BN from "bn.js";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";
import { Raydium, DEVNET_PROGRAM_ID } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT, TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { readFileSync } from "fs";
import { resolve as resolvePath } from "path";

const commitment = (process.env.SOLANA_COMMITMENT ?? "confirmed") as Commitment;
const endpoint = process.env.SOLANA_RPC ?? clusterApiUrl("devnet");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
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

function parseDecimals(): number {
  const raw = process.env.TOKEN_DECIMALS ?? "2";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 18)
    throw new Error(`Invalid TOKEN_DECIMALS value: ${raw}`);
  return parsed;
}

function parseAmount(name: string, decimals: number): BN {
  const rawValue = process.env[name];
  if (!rawValue) throw new Error(`Missing ${name}`);
  const [wholeRaw, fractionRaw] = rawValue.split(".");
  const whole = wholeRaw ?? "0";
  const fraction = fractionRaw ?? "";
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction))
    throw new Error(`Invalid numeric value for ${name}: ${rawValue}`);
  if (fraction.length > decimals)
    throw new Error(
      `${name} (${rawValue}) has more fractional digits than the mint decimals (${decimals})`
    );
  const padded = fraction.padEnd(decimals, "0");
  const amount = `${whole}${padded}`.replace(/^0+/, "");
  return new BN(amount === "" ? "0" : amount, 10);
}

async function airdropIfNeeded(connection: Connection, payer: Keypair, solRequired: number) {
  const balance = await connection.getBalance(payer.publicKey);
  if (balance < solRequired * LAMPORTS_PER_SOL) {
    console.log(`Airdropping ${(solRequired - balance / LAMPORTS_PER_SOL).toFixed(2)} SOL...`);
    const sig = await connection.requestAirdrop(payer.publicKey, solRequired * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, commitment);
  }
}

async function ensureTokenBalance(connection: Connection, payer: Keypair, mint: PublicKey, requiredAmount: BN) {
  const ata = await getAssociatedTokenAddress(mint, payer.publicKey);
  const accountInfo = await connection.getTokenAccountBalance(ata).catch(() => null);
  const balance = accountInfo ? new BN(accountInfo.value.amount) : new BN(0);
  if (balance.lt(requiredAmount)) {
    throw new Error(
      `Token account ${ata.toBase58()} balance ${balance.toString()} is less than required ${requiredAmount.toString()}`
    );
  }
}

async function main() {
  const payer = loadKeypair();
  const connection = new Connection(endpoint, commitment);

  // Ensure enough SOL for fees + WSOL wrapping
  await airdropIfNeeded(connection, payer, 2);

  const raydium = await Raydium.load({
    connection,
    owner: payer,
    cluster: "devnet",
    disableLoadToken: false,
    blockhashCommitment: commitment,
  });

  const configs = await raydium.api.getCpmmConfigs();
  const configIndex = Number.parseInt(process.env.POOL_FEE_CONFIG_INDEX ?? "0", 10);
  if (Number.isNaN(configIndex) || configIndex < 0 || configIndex >= configs.length)
    throw new Error(`POOL_FEE_CONFIG_INDEX must be between 0 and ${configs.length - 1}`);
  const feeConfig = configs[configIndex]!;

  const mint = new PublicKey(requireEnv("TOKEN_MINT_ADDRESS"));
  const decimals = parseDecimals();

  const tokenAmount = parseAmount("POOL_TOKEN_AMOUNT", decimals);
  const wsolAmount = parseAmount("POOL_WSOL_AMOUNT", 9); // WSOL always 9 decimals

  if (tokenAmount.isZero() || wsolAmount.isZero())
    throw new Error("Pool bootstrap amounts must be greater than zero");

  await ensureTokenBalance(connection, payer, mint, tokenAmount);

  const result = await raydium.cpmm.createPool({
    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
    mintA: {
      address: mint.toBase58(),
      decimals,
      programId: TOKEN_PROGRAM_ID.toBase58(),
    },
    mintB: {
      address: NATIVE_MINT.toBase58(),
      decimals: 9,
      programId: TOKEN_PROGRAM_ID.toBase58(),
    },
    mintAAmount: tokenAmount,
    mintBAmount: wsolAmount,
    startTime: new BN(Math.floor(Date.now() / 1000)),
    feeConfig,
    associatedOnly: false, // allows creation of WSOL/token accounts
    ownerInfo: {
      feePayer: payer.publicKey,
      useSOLBalance: true,
    },
  });

  const { txId } = await result.execute({ skipPreflight: false });
  console.log("Raydium pool created.");
  console.log("Transaction:", txId);
  console.log("Pool address:", result.extInfo.address.poolId.toBase58());
  console.log("Vault A:", result.extInfo.address.vaultA.toBase58());
  console.log("Vault B:", result.extInfo.address.vaultB.toBase58());
  console.log("LP mint:", result.extInfo.address.lpMint.toBase58());
}

main().catch((error) => {
  console.error("Failed to create Raydium pool:", error);
  process.exit(1);
});
