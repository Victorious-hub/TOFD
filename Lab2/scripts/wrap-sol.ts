import "dotenv/config";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";
import {
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import bs58 from "bs58";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const endpoint = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
const commitment = (process.env.SOLANA_COMMITMENT ?? "confirmed") as Commitment;

const payer = Keypair.fromSecretKey(bs58.decode(requireEnv("PAYER_SECRET")));
const owner = process.env.WRAP_SOL_OWNER
  ? new PublicKey(process.env.WRAP_SOL_OWNER)
  : payer.publicKey;

const amountInput = process.env.WRAP_SOL_AMOUNT ?? "0.5";
const amountFloat = Number.parseFloat(amountInput);
if (!Number.isFinite(amountFloat) || amountFloat <= 0) {
  throw new Error(`Invalid WRAP_SOL_AMOUNT value: ${amountInput}`);
}
const lamports = Math.round(amountFloat * LAMPORTS_PER_SOL);
if (!Number.isSafeInteger(lamports)) {
  throw new Error(
    `Requested amount ${amountFloat} SOL is too large for a single transaction`,
  );
}

async function wrapSol() {
  const connection = new Connection(endpoint, commitment);
  const ata = await getAssociatedTokenAddress(NATIVE_MINT, owner, false);
  const instructions = [];

  const ataInfo = await connection.getAccountInfo(ata);
  if (!ataInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        NATIVE_MINT,
      ),
    );
  }

  instructions.push(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: ata,
      lamports,
    }),
  );

  instructions.push(createSyncNativeInstruction(ata));

  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = payer.publicKey;
  const latestBlockhash = await connection.getLatestBlockhash(commitment);
  tx.recentBlockhash = latestBlockhash.blockhash;

  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment,
  });

  console.log("Wrapped SOL signature:", signature);
  console.log("WSOL Associated Token Address:", ata.toBase58());
}

wrapSol().catch((err) => {
  console.error("Failed to wrap SOL:", err);
  process.exit(1);
});