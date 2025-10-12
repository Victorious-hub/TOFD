
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  NATIVE_MINT,
} from "@solana/spl-token";
import bs58 from "bs58";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const owner = Keypair.fromSecretKey(
  bs58.decode("5THvVxdmR72XrejkrxmYVVgBQGuz9iHHxmdnnSw4HpETH5NAY6wPG4poP5xhtLkLXXFQW84f6JP8vgbLXidzDP5n"),
);

async function wrapSol() {
  const amount = 1 * LAMPORTS_PER_SOL; // 1 SOL
  const ata = await getAssociatedTokenAddress(NATIVE_MINT, owner.publicKey);

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      owner.publicKey,
      ata,
      owner.publicKey,
      NATIVE_MINT,
    ),
    SystemProgram.transfer({
      fromPubkey: owner.publicKey,
      toPubkey: ata,
      lamports: amount,
    }),
    createSyncNativeInstruction(ata),
  );

  tx.feePayer = owner.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(owner);

  const sig = await connection.sendRawTransaction(tx.serialize());
  console.log("Wrapped SOL tx:", sig);
  console.log("WSOL ATA:", ata.toBase58());
}

// (venv) shyskov@Shyskov:~/Solana/Lab2/scripts$ npx tsx wsol.ts
// bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
// Wrapped SOL tx: 4rzwFZUh3KYKKkwkCa6D1xPqq8UJKoaMghkUBd391wD7JJJ7ZkjrjMWn1duh3BEm8fcmVMzrwisxtxnoWdwjkmnJ
// WSOL ATA: 8Weamv9mSzw5Wq1iqXL5ahJ5S91oj1Yfb3XzMT19mDnH

wrapSol();
