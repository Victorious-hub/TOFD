import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createMetadataAccountV3, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { createSignerFromKeypair } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import fs from "fs";

/**
 * Upload and create on-chain metadata for a token.
 * @param {Object} offChainMetadata - Object containing name, symbol, description, image, etc.
 */
const uploadMetadataForToken = async (offChainMetadata) => {
  const endpoint = "http://127.0.0.1:8899";
  const connection = new Connection(endpoint);
  const umi = createUmi(endpoint);

  umi.use(mplTokenMetadata());

  const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  console.log("Using Metaplex Token Metadata program:", METADATA_PROGRAM_ID.toBase58());

  const secretKey = JSON.parse(fs.readFileSync("wallet.json", "utf8"));
  const web3jsKeyPair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const keypair = fromWeb3JsKeypair(web3jsKeyPair);
  const signer = createSignerFromKeypair(umi, keypair);
  umi.identity = signer;
  umi.payer = signer;

  const CreateMetadataAccountV3Args = {
    mint: fromWeb3JsPublicKey(
      new PublicKey("GaH7NMv1Rsi3ECzY3DrHb6QGYb2CkTwwk8s4j9Wqzj7J") // replace with your token mint
    ),
    mintAuthority: signer,
    payer: signer,
    updateAuthority: fromWeb3JsPublicKey(web3jsKeyPair.publicKey),
    data: {
      name: offChainMetadata.name,
      symbol: offChainMetadata.symbol,
      uri: "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/spl-token.json", // 🔗 Replace with uploaded JSON URL
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    },
    isMutable: true,
    collectionDetails: null,
  };

  try {
    console.log("🚀 Building and sending transaction...");
    const instruction = createMetadataAccountV3(umi, CreateMetadataAccountV3Args);
    const transaction = await instruction.buildAndSign(umi);
    const transactionSignature = await umi.rpc.sendTransaction(transaction);
    console.log("Instruction created:", transactionSignature);
    const signature = base58.deserialize(transactionSignature);

    console.log("Metadata account created successfully!");
    console.log("Transaction signature:", signature);
    console.log(`Explorer link (local validator): http://localhost:8899/tx/${signature}`);
  } catch (err) {
    console.error("Transaction failed:", err.message);
    if (err.getLogs) {
      try {
        console.log("Transaction logs:", await err.getLogs(connection));
      } catch (logErr) {
        console.error("Could not fetch logs:", logErr.message);
      }
    }
  }
};

(async () => {
  const offChainMetadata = {
    name: "Bronze Sword13123123",
    symbol: "⚔️",
    description: "Your token description13123123",
    image:
      "https://w7.pngwing.com/pngs/153/594/png-transparent-solana-coin-sign-icon-shiny-golden-symmetric-geometrical-design.png",
  };
  await uploadMetadataForToken(offChainMetadata);
})();


