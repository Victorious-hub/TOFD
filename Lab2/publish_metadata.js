// import {
// 	createV1,
// 	findMetadataPda,
// 	mplTokenMetadata,
// 	TokenStandard
// } from "@metaplex-foundation/mpl-token-metadata";
// import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
// import {
//   generateSigner,
//   percentAmount,
//   publicKey,
//   signerIdentity,
//   sol,
// } from "@metaplex-foundation/umi";
// import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
// import { base58 } from "@metaplex-foundation/umi/serializers";

// const umi = createUmi("http://127.0.0.1:8899")
// 	.use(mplTokenMetadata())
// 	.use(mplToolbox());

// // Generate a new keypair signer.
// const signer = generateSigner(umi);

// // Tell umi to use the new signer.
// umi.use(signerIdentity(signer));

// // your SPL Token mint address
// const mint = publicKey("6EQGFR5mKKyoPwjU96R8fg3EADzLrbebXy3t7PPv1QRy");
 

// // Sample Metadata for our Token
// const tokenMetadata = {
// 	name: "Solana Gold",
// 	symbol: "GOLDSOL",
// 	uri: "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/spl-token.json",
// };

// // Add metadata to an existing SPL token wrapper function
// async function addMetadata() {
// 	// Airdrop 2 SOL to the identity
//     // if you end up with a 429 too many requests error, you may have to use
//     // a different rpc other than the free default one supplied.
//     await umi.rpc.airdrop(umi.identity.publicKey, sol(2));

//     // derive the metadata account that will store our metadata data onchain
// 	const metadataAccountAddress = await findMetadataPda(umi, {
// 		mint: mint,
// 	});

// 	const tx = await createV1(umi, {
// 		mint,
// 		authority: umi.identity,
// 		payer: umi.identity,
// 		updateAuthority: umi.identity,
// 		name: tokenMetadata.name,
// 		symbol: tokenMetadata.symbol,
// 		uri: tokenMetadata.uri,
// 		sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
// 		tokenStandard: TokenStandard.Fungible,
// 	}).sendAndConfirm(umi);

// 	let txSig = base58.deserialize(tx.signature);
// 	console.log(`https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
// }

// // // run the function
// addMetadata();


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
  // ✅ You are running solana-test-validator locally
  const endpoint = "https://api.devnet.solana.com";
  const connection = new Connection(endpoint);
  const umi = createUmi(endpoint);

  // ✅ Register the Token Metadata program in UMI context
  umi.use(mplTokenMetadata());

  // ✅ The official Metaplex Token Metadata Program ID
  const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  console.log("Using Metaplex Token Metadata program:", METADATA_PROGRAM_ID.toBase58());

  // ✅ Load your keypair
  const secretKey = JSON.parse(fs.readFileSync("wallet.json", "utf8"));
  const web3jsKeyPair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const keypair = fromWeb3JsKeypair(web3jsKeyPair);
  const signer = createSignerFromKeypair(umi, keypair);
  umi.identity = signer;
  umi.payer = signer;

  // ✅ Create metadata account args
  const CreateMetadataAccountV3Args = {
    mint: fromWeb3JsPublicKey(
      new PublicKey("3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg") // replace with your token mint
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

    console.log("✅ Metadata account created successfully!");
    console.log("Transaction signature:", signature);
    console.log(`Explorer link (local validator): http://localhost:8899/tx/${signature}`);
  } catch (err) {
    console.error("❌ Transaction failed:", err.message);
    if (err.getLogs) {
      try {
        console.log("Transaction logs:", await err.getLogs(connection));
      } catch (logErr) {
        console.error("Could not fetch logs:", logErr.message);
      }
    }
  }
};

// Example usage
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


