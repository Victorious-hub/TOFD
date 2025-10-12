import "dotenv/config";

import BN from "bn.js";
import bs58 from "bs58";
import Decimal from "decimal.js";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import type { Commitment, Cluster } from "@solana/web3.js";
import {
  PriceStatus,
  PythHttpClient,
  getPythProgramKeyForCluster,
} from "@pythnetwork/client";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { readFileSync } from "fs";
import { resolve as resolvePath } from "path";

type PriceTarget = "SOL" | "BTC" | "ETH" | "USDC";

type PriceRecord = {
  symbol: string;
  price: number;
  confidence: number;
};

const commitment = (process.env.SOLANA_COMMITMENT ?? "confirmed") as Commitment;
const endpoint = process.env.SOLANA_RPC ?? clusterApiUrl("devnet");
const cluster = (process.env.PYTH_CLUSTER ?? "devnet") as Cluster;

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
  const path = process.env.PAYER_KEYPAIR_PATH ?? "../../lab2/wallet.json";
  const resolved = resolvePath(process.cwd(), path);
  const secret = readFileSync(resolved, "utf-8").trim();
  return Keypair.fromSecretKey(bs58.decode(secret));
}

function findPrice(
  data: Awaited<ReturnType<PythHttpClient["getData"]>>,
  target: PriceTarget,
): PriceRecord {
  const patterns: Record<PriceTarget, RegExp[]> = {
    SOL: [/SOL\/USD/i, /WSOL\/USD/i],
    BTC: [/BTC\/USD/i],
    ETH: [/ETH\/USD/i],
    USDC: [/USDC\/USD/i],
  };

  const preferredSymbols: Record<PriceTarget, string[]> = {
    SOL: ["Crypto.SOL/USD", "Crypto.WSOL/USD", "Crypto.MSOL/USD"],
    BTC: ["Crypto.BTC/USD", "Crypto.WBTC/USD", "Crypto.TBTC/USD"],
    ETH: ["Crypto.ETH/USD", "Crypto.WETH/USD", "Crypto.STETH/USD"],
    USDC: ["Crypto.USDC/USD", "Crypto.ER.FUSDC/USD", "Crypto.ER.SYRUPUSDC/USD"],
  };

  const candidates = preferredSymbols[target];
  for (const symbol of candidates) {
    const price = data.productPrice.get(symbol);
    if (!price) {
      continue;
    }

  const rawPrice = price.price ?? price.aggregate.price;
  const value = rawPrice;
  if (value === undefined) {
      continue;
    }
    if (price.status !== PriceStatus.Trading) {
      console.warn(`⚠️  ${symbol} status is ${PriceStatus[price.status]} – using latest available price.`);
    }

    const rawConfidence = price.confidence ?? price.aggregate.confidence;
    const confidence = rawConfidence ?? 0;
    if (process.env.DEBUG_PYTH === "1") {
      console.log(
        `[DEBUG] ${symbol}: raw=${rawPrice} agg=${price.aggregate.price} expo=${price.exponent} rawConf=${rawConfidence} => price=${value} confidence=${confidence}`,
      );
    }
    return {
      symbol,
      price: value,
      confidence,
    };
  }

  // If preferred symbols did not yield a result, fall back to regex search across all feeds.
  for (const [symbol, price] of data.productPrice.entries()) {
    const matches = patterns[target].some((regex) => regex.test(symbol));
    if (!matches) continue;

  const rawPrice = price.price ?? price.aggregate.price;
  const value = rawPrice;
  if (value === undefined) {
      continue;
    }
    if (price.status !== PriceStatus.Trading) {
      console.warn(`⚠️  ${symbol} status is ${PriceStatus[price.status]} – using latest available price.`);
    }

  const rawConfidence = price.confidence ?? price.aggregate.confidence;
  const confidence = rawConfidence ?? 0;
    if (process.env.DEBUG_PYTH === "1") {
      console.log(
        `[DEBUG] ${symbol}: raw=${rawPrice} expo=${price.exponent} => price=${value} confidence=${confidence}`,
      );
    }
    return {
      symbol,
      price: value,
      confidence,
    };
  }

  throw new Error(`Unable to locate Pyth price feed for ${target}`);
}

function bnToDecimal(raw: BN, decimals: number): Decimal {
  return new Decimal(raw.toString()).div(new Decimal(10).pow(decimals));
}

async function main() {
  const connection = new Connection(endpoint, commitment);
  const payer = loadKeypair();

  const pythClient = new PythHttpClient(connection, getPythProgramKeyForCluster(cluster));
  const pythData = await pythClient.getData();

  if (process.env.DEBUG_PYTH === "1") {
    const matches = pythData.symbols.filter((symbol: string) => /SOL|BTC|ETH|USDC/i.test(symbol));
    console.log("Available Pyth symbols matching SOL/BTC/ETH/USDC:");
    matches.forEach((symbol: string) => console.log(`  - ${symbol}`));
  }

  const prices: Record<PriceTarget, PriceRecord> = {
    SOL: findPrice(pythData, "SOL"),
    BTC: findPrice(pythData, "BTC"),
    ETH: findPrice(pythData, "ETH"),
    USDC: findPrice(pythData, "USDC"),
  };

  console.log("Pyth oracle prices (USD):");
  (Object.entries(prices) as Array<[PriceTarget, PriceRecord]>).forEach(([code, record]) => {
    console.log(
      `  ${code}: $${record.price.toPrecision(8)} ± ${record.confidence.toPrecision(4)} (${record.symbol})`,
    );
  });

  const tokenMint = new PublicKey(requireEnv("TOKEN_MINT_ADDRESS"));
  const poolIdRaw = process.env.TOKEN_POOL_ID ?? process.env.SWAP_POOL_ID;
  if (!poolIdRaw) {
    throw new Error("Missing TOKEN_POOL_ID or SWAP_POOL_ID environment variable");
  }
  const poolId = new PublicKey(poolIdRaw);

  const raydium = await Raydium.load({
    connection,
    owner: payer,
    cluster,
    disableLoadToken: false,
    blockhashCommitment: commitment,
  });

  const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId.toBase58());

  const tokenIsMintA = poolInfo.mintA.address === tokenMint.toBase58();
  if (!tokenIsMintA && poolInfo.mintB.address !== tokenMint.toBase58()) {
    throw new Error("Provided pool does not contain the specified token mint");
  }

  const tokenDecimals = tokenIsMintA ? poolInfo.mintA.decimals : poolInfo.mintB.decimals;
  const wsolDecimals = tokenIsMintA ? poolInfo.mintB.decimals : poolInfo.mintA.decimals;

  const tokenReserve = tokenIsMintA ? rpcData.vaultAAmount : rpcData.vaultBAmount;
  const wsolReserve = tokenIsMintA ? rpcData.vaultBAmount : rpcData.vaultAAmount;

  const tokenReserveAmount = bnToDecimal(tokenReserve, tokenDecimals);
  const wsolReserveAmount = bnToDecimal(wsolReserve, wsolDecimals);

  if (tokenReserveAmount.isZero()) {
    throw new Error("Token reserve amount is zero; cannot derive price");
  }

  const priceTokenInWSOL = wsolReserveAmount.div(tokenReserveAmount);

  const solPriceUsd = new Decimal(prices.SOL.price);
  const btcPriceUsd = new Decimal(prices.BTC.price);
  const ethPriceUsd = new Decimal(prices.ETH.price);
  const usdcPriceUsd = new Decimal(prices.USDC.price);

  const tokenPriceUsd = priceTokenInWSOL.mul(solPriceUsd);
  const tokenPriceUsdc = tokenPriceUsd.div(usdcPriceUsd);
  const tokenPriceInBTC = tokenPriceUsd.div(btcPriceUsd);
  const tokenPriceInETH = tokenPriceUsd.div(ethPriceUsd);

  console.log("\nDerived token pricing:");
  console.log(`  Token mint: ${tokenMint.toBase58()}`);
  console.log(`  Pool: ${poolId.toBase58()}`);
  console.log(`  Price in WSOL: ${priceTokenInWSOL.toSignificantDigits(8).toString()} WSOL`);
  console.log(`  Price in USDC: $${tokenPriceUsdc.toSignificantDigits(8).toString()} (via WSOL→USDC)`);
  console.log(`  Price in USD: $${tokenPriceUsd.toSignificantDigits(8).toString()}`);
  console.log(`  Price in BTC: ${tokenPriceInBTC.toSignificantDigits(8).toString()} BTC`);
  console.log(`  Price in ETH: ${tokenPriceInETH.toSignificantDigits(8).toString()} ETH`);
}

main().catch((error) => {
  console.error("Failed to fetch price data:", error);
  process.exit(1);
});