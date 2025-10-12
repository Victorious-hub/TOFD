import "dotenv/config";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import bs58 from "bs58";
import { readFileSync, writeFileSync } from "fs";
import { resolve as resolvePath } from "path";

const endpoint = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
const commitment = (process.env.SOLANA_COMMITMENT ?? "confirmed") as Commitment;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function loadPayer(): Keypair {
  if (process.env.PAYER_SECRET) {
    return Keypair.fromSecretKey(bs58.decode(process.env.PAYER_SECRET));
  }
  const path = process.env.PAYER_KEYPAIR_PATH ?? "../../Lab2/wallet.json";
  const resolved = resolvePath(process.cwd(), path);
  const secret = readFileSync(resolved, "utf-8").trim();
  return Keypair.fromSecretKey(bs58.decode(secret));
}

function parseMint(): PublicKey {
  return new PublicKey(requireEnv("TOKEN_MINT_ADDRESS"));
}

function parseDecimals(): number {
  const raw = process.env.TOKEN_DECIMALS ?? "9";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 19) {
    throw new Error(`Invalid TOKEN_DECIMALS value: ${raw}`);
  }
  return parsed;
}

function parseCount(): number {
  const raw = process.argv[2] ?? process.env.NEW_WALLET_COUNT ?? "3";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid wallet count: ${raw}`);
  }
  return parsed;
}

function parseTokenAmount(decimals: number): bigint {
  const raw = process.env.NEW_WALLET_TOKEN_AMOUNT ?? "10";
  const [whole, fraction = ""] = raw.split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error(`Invalid token amount format: ${raw}`);
  }
  if (fraction.length > decimals) {
    throw new Error(
      `Token amount ${raw} has more fractional digits than mint decimals (${decimals})`,
    );
  }
  const paddedFraction = fraction.padEnd(decimals, "0");
  const amountStr = `${whole}${paddedFraction}`.replace(/^0+/, "");
  return amountStr === "" ? 0n : BigInt(amountStr);
}

function parseAirdrop(): number {
  const raw = process.env.NEW_WALLET_AIRDROP_SOL ?? "0.5";
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid NEW_WALLET_AIRDROP_SOL value: ${raw}`);
  }
  return Math.round(value * LAMPORTS_PER_SOL);
}

async function ensureAta(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  try {
    await getAccount(connection, ata, commitment);
    return ata;
  } catch (error) {
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        mint,
      ),
    );
    await sendAndConfirmTransaction(connection, tx, [payer], { commitment });
    return ata;
  }
}

async function requestAirdrop(
  connection: Connection,
  recipient: PublicKey,
  lamports: number,
): Promise<boolean> {
  if (lamports <= 0) {
    return false;
  }
  try {
    const signature = await connection.requestAirdrop(recipient, lamports);
    await connection.confirmTransaction(signature, commitment);
    return true;
  } catch (error) {
    console.warn(
      `⚠️  Airdrop of ${lamports / LAMPORTS_PER_SOL} SOL to ${recipient.toBase58()} failed. Fund manually and rerun if needed.`,
    );
    console.warn("   →", error);
    return false;
  }
}

async function transferTokens(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  sourceAta: PublicKey,
  destinationAta: PublicKey,
  amount: bigint,
  decimals: number,
) {
  if (amount <= 0n) {
    return;
  }
  const tx = new Transaction().add(
    createTransferCheckedInstruction(
      sourceAta,
      mint,
      destinationAta,
      payer.publicKey,
      Number(amount),
      decimals,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
  await sendAndConfirmTransaction(connection, tx, [payer], { commitment });
}

async function main() {
  const connection = new Connection(endpoint, commitment);
  const payer = loadPayer();
  const mint = parseMint();
  const decimals = parseDecimals();
  const count = parseCount();
  const tokenAmount = parseTokenAmount(decimals);
  const airdropLamports = parseAirdrop();

  const payerAta = await ensureAta(connection, payer, mint, payer.publicKey);

  const createdWallets: Array<{
    index: number;
    publicKey: string;
    secret: string;
    tokenAccount: string;
    airdropped?: boolean;
  }> = [];

  for (let i = 0; i < count; i += 1) {
    const wallet = Keypair.generate();
    console.log(`Wallet #${i + 1}: ${wallet.publicKey.toBase58()}`);
    console.log(`   Secret (base58): ${bs58.encode(wallet.secretKey)}`);

    const funded = await requestAirdrop(connection, wallet.publicKey, airdropLamports);
    if (!funded && airdropLamports > 0) {
      console.warn("   Airdrop skipped; continue after funding manually if required.");
    }

    const walletAta = await ensureAta(connection, payer, mint, wallet.publicKey);
    await transferTokens(
      connection,
      payer,
      mint,
      payerAta,
      walletAta,
      tokenAmount,
      decimals,
    );

    createdWallets.push({
      index: i + 1,
      publicKey: wallet.publicKey.toBase58(),
      secret: bs58.encode(wallet.secretKey),
      tokenAccount: walletAta.toBase58(),
      airdropped: funded,
    });

    console.log(
      `Created wallet ${wallet.publicKey.toBase58()} with ATA ${walletAta.toBase58()}`,
    );
  }

  const outputPath = resolvePath(process.cwd(), "generated-wallets.json");
  writeFileSync(outputPath, JSON.stringify(createdWallets, null, 2), "utf-8");
  console.log(`Saved ${createdWallets.length} wallets to ${outputPath}`);
}

main().catch((error) => {
  console.error("Failed to create wallets:", error);
  process.exit(1);
});