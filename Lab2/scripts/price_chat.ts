import "dotenv/config";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";

// Настройки
const endpoint = process.env.SOLANA_RPC ?? clusterApiUrl("devnet");
const connection = new Connection(endpoint, "confirmed");
const poolId = new PublicKey(process.env.TOKEN_POOL_ID!);
const tokenMint = new PublicKey(process.env.TOKEN_MINT_ADDRESS!);

async function main() {
  const raydium = await Raydium.load({
    connection,
    owner: null, // для чтения данных о пуле нам не нужен ключ
    cluster: "devnet",
    disableLoadToken: false,
  });

  // Получаем данные пула
  const { poolInfo, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(poolId);

  const baseMint = new PublicKey(poolInfo.mintA.address);
  const quoteMint = new PublicKey(poolInfo.mintB.address);

  // Определяем какая монета наш токен
  const baseIsToken = baseMint.equals(tokenMint);
  const tokenReserve = baseIsToken ? rpcData.baseReserve : rpcData.quoteReserve;
  const wsolReserve = baseIsToken ? rpcData.quoteReserve : rpcData.baseReserve;
  const tokenDecimals = baseIsToken ? poolInfo.mintA.decimals : poolInfo.mintB.decimals;
  const wsolDecimals = baseIsToken ? poolInfo.mintB.decimals : poolInfo.mintA.decimals;

  // Цена токена в WSOL
  const priceInWsol = (Number(wsolReserve.toString()) / 10 ** wsolDecimals) /
                      (Number(tokenReserve.toString()) / 10 ** tokenDecimals);

  console.log(`Token price in WSOL: ${priceInWsol.toFixed(6)}`);

  // Получаем цену WSOL в USD с Pyth Devnet
  const PYTH_WSOL_USD = new PublicKey("J83m6R7zyVnnB7XvE9Yhe2e6QeXq8ZffJ3mK3a4k55sc"); // WSOL/USD на Devnet
  const accountInfo = await connection.getAccountInfo(PYTH_WSOL_USD);
  if (!accountInfo) throw new Error("Cannot fetch Pyth WSOL price");

  // В Pyth цена хранится в формате i64 + экспонента, проще использовать библиотеку pyth-client
  const { parsePriceFeedData, PriceFeed } = await import("@pythnetwork/client");
  const feed = parsePriceFeedData(accountInfo.data);
  const wsolUsd = feed.agg.price / 10 ** feed.expo;
  console.log(`WSOL price in USD: ${wsolUsd}`);

  // Цена токена в USD
  const tokenUsd = priceInWsol * wsolUsd;
  console.log(`Token price in USD: ${tokenUsd.toFixed(6)}`);
}

main().catch(console.error);
