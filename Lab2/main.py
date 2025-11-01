import asyncio
import json
from pathlib import Path

from solders.keypair import Keypair
from solders.pubkey import Pubkey

from solana.rpc.async_api import AsyncClient
from spl.token.async_client import AsyncToken
from spl.token.constants import TOKEN_PROGRAM_ID

LAMPORTS_PER_SOL = 1_000_000_000


class SolanaWorker:
    def __init__(self, keypair: Keypair, client: AsyncClient):
        self.keypair = keypair
        self.client = client
        self.public_key = self.keypair.pubkey()

    async def create_solana_wallet(self, filename="wallet.json") -> bool:
        keypair_bytes = list(self.keypair.to_bytes())
        with open(filename, "w") as f:
            json.dump(keypair_bytes, f)
        print(f"Wallet saved to {filename}")
        print(f"Public Key: {self.public_key}")
        return True

    async def airdrop_sol(self, amount_sol: float = 1.0):
        lamports = int(amount_sol * LAMPORTS_PER_SOL)
        print(f"Requesting airdrop of {amount_sol} SOL to {self.public_key}...")
        resp = await self.client.request_airdrop(self.public_key, lamports)
        signature = resp.value
        print(f"Awaiting confirmation: {signature}")
        await self.client.confirm_transaction(signature)
        print("Airdrop confirmed!")

    async def get_balance(self, pubkey: Pubkey | None = None):
        pubkey = pubkey or self.public_key
        resp = await self.client.get_balance(pubkey)
        lamports = resp.value
        sol = lamports / LAMPORTS_PER_SOL
        print(f"Balance for {pubkey}: {sol} SOL")
        return sol

    async def create_token(self, decimals=2, filename="mint.json"):
        print("Creating new SPL token mint...")
        mint_authority = self.keypair
        freeze_authority = self.keypair

        program_id = TOKEN_PROGRAM_ID
        try:
            if not isinstance(program_id, Pubkey):
                program_id = Pubkey.from_string(str(program_id))
        except Exception:
            pass

        token = await AsyncToken.create_mint(
            conn=self.client,
            payer=self.keypair,
            mint_authority=mint_authority.pubkey(),
            decimals=decimals,
            program_id=program_id,
            freeze_authority=freeze_authority.pubkey(),
        )

        mint_pubkey = str(token.pubkey)

        mint_info = {
            "mint_address": mint_pubkey,
            "decimals": decimals,
            "mint_authority": str(mint_authority.pubkey()),
            "freeze_authority": str(freeze_authority.pubkey()),
            "network": str(self.client._provider.endpoint_uri),
        }

        Path(filename).write_text(json.dumps(mint_info, indent=4), encoding="utf-8")

        print(f"Mint created: {mint_pubkey}")
        print(f"Saved mint info to {filename}")
        return token

    async def mint_to_wallet(self, token: AsyncToken, amount: float):
        print(f"Minting {amount} tokens to wallet {self.public_key}...")

        ata = await token.create_associated_token_account(self.public_key)
        print(f"Created ATA: {ata}")

        mint_info = await token.get_mint_info()
        decimals = mint_info.decimals
        tx_sig = await token.mint_to(
            dest=ata,
            mint_authority=self.keypair,
            amount=int(amount * (10 ** decimals)),
        )
        print(f"Mint complete, transaction: {tx_sig}")

        try:
            balance = await token.get_balance(ata)
            ui_amount = balance.get("result", {}).get("value", {}).get("uiAmount") if isinstance(balance, dict) else getattr(balance, "ui_amount", None)
            print(f"💰 Token balance (ui): {ui_amount}")
        except Exception:
            pass

        return ata

    async def mint_to_many(self, mint_addr: str, recipients: list[str], amount_each: float):
        print(f"Minting {amount_each} tokens to {len(recipients)} recipients...")
        token = AsyncToken(self.client, Pubkey.from_string(mint_addr), TOKEN_PROGRAM_ID, self.keypair)

        mint_info = await token.get_mint_info()
        decimals = mint_info.decimals
        base_amount = int(amount_each * (10 ** decimals))

        results = []
        for r in recipients:
            recipient_pub = Pubkey.from_string(r)
            ata = await token.create_associated_token_account(recipient_pub)
            print(f"ATA for {r}: {ata}")
            sig = await token.mint_to(dest=ata, mint_authority=self.keypair, amount=base_amount)
            print(f"Minted to {r}, tx: {sig}")
            results.append((r, ata, sig))

        return results

    async def prepare_metadata(self, mint_addr: str, name: str, symbol: str, uri: str, seller_fee_basis_points: int = 0, filename: str = "metadata.json"):
        metadata = {
            "name": name,
            "symbol": symbol,
            "description": f"Token {name} ({symbol})",
            "seller_fee_basis_points": seller_fee_basis_points,
            "image": uri,
            "external_url": "",
            "attributes": [],
            "properties": {"files": [{"uri": uri, "type": "image/png"}]},
            "mint": mint_addr,
        }
        Path(filename).write_text(json.dumps(metadata, indent=4), encoding="utf-8")
        print(f"📄 Metadata file written to {filename}")
        print("To publish metadata on-chain use Metaplex CLI or a library. Example (Metaplex CLI):")
        print("  metaplex upload <assets_folder> --env devnet")
        print("  metaplex create_candy_machine -k <keypair.json> --env devnet")
        print("Or use Metaplex/token-metadata program to create metadata account for the mint.")
        return filename

    async def run_demo_flow(self):
        print("\n=== Running automated demo flow ===")
        await self.create_solana_wallet("payer_wallet.json")
        await self.airdrop_sol(2.0)
        token = await self.create_token(decimals=2, filename="demo_mint.json")
        mint_addr = str(token.pubkey)
        meta_file = await self.prepare_metadata(
            mint_addr=mint_addr,
            name="DemoToken",
            symbol="DTK",
            uri="https://example.com/image.png",
            seller_fee_basis_points=0,
            filename="demo_metadata.json",
        )

        recipients = []
        for i in range(1, 4):
            kp = Keypair()
            fname = f"recipient_{i}_wallet.json"
            with open(fname, "w") as f:
                json.dump(list(kp.to_bytes()), f)
            recipients.append(str(kp.pubkey()))
            print(f"Recipient {i} public key: {recipients[-1]} (saved to {fname})")

        results = await self.mint_to_many(mint_addr, recipients, amount_each=10.0)

        print("\n=== Demo flow complete ===")
        print(f"Mint: {mint_addr}")
        print(f"Metadata file: {meta_file}")
        for r, ata, sig in results:
            print(f"Recipient {r} -> ATA {ata} (tx: {sig})")
        return True


async def main():
    print("Choose network:\n1. Devnet\n2. Local Validator\n3. Testnet")
    choice = int(input("Your choice: "))
    if choice == 1:
        client = AsyncClient("https://api.devnet.solana.com")
    elif choice == 2:
        client = AsyncClient("http://127.0.0.1:8899")
    else:
        client = AsyncClient("https://api.testnet.solana.com")

    keypair = Keypair()
    obj = SolanaWorker(keypair, client)

    while True:
        print("\nActions:")
        print("1. Create and save new wallet")
        print("2. Airdrop SOL")
        print("3. Create SPL Token Mint")
        print("4. Mint tokens to wallet")
        print("5. SPL Associated Token Accounts and token airdrop to accounts")
        print("0. Exit")

        try:
            action = int(input("Choose action: "))
        except ValueError:
            print("Enter a valid number.")
            continue

        if action == 0:
            break
        elif action == 1:
            await obj.create_solana_wallet()
        elif action == 2:
            amount = float(input("Enter amount of SOL to airdrop: "))
            await obj.airdrop_sol(amount)
        elif action == 3:
            decimals = int(input("Enter token decimals (e.g., 2): "))
            token = await obj.create_token(decimals)
            print(f"Mint address: {token.pubkey}")
        elif action == 4:
            mint_addr = input("Enter mint address: ")
            token = AsyncToken(obj.client, Pubkey.from_string(mint_addr), TOKEN_PROGRAM_ID, obj.keypair)
            amount = float(input("Enter amount of tokens to mint: "))
            await obj.mint_to_wallet(token, amount)
        elif action == 5:
            await obj.run_demo_flow()
        else:
            print("Invalid action.")


if __name__ == "__main__":
    asyncio.run(main())
