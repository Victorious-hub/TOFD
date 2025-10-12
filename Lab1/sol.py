import asyncio
import json
from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient
from solders.system_program import transfer, TransferParams
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.pubkey import Pubkey
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.system_program import create_account, CreateAccountParams

LAMPORTS_PER_SOL = 1_000_000_000

class SolanaWorker:
    def __init__(self, keypair: Keypair, client: AsyncClient):
        self.keypair = keypair
        self.client = client
        self.public_key = self.keypair.pubkey()
        self.secret_key = self.keypair.secret()

    async def create_solana_wallet(self, filename="wallet.json") -> bool:
        keypair_bytes = list(self.keypair.to_bytes())
        with open(filename, "w") as f:
            json.dump(keypair_bytes, f)
        print(f"Wallet saved to {filename}")
        print(f"Public Key: {self.public_key}")
        return True

    async def airdrop_sol(self, amount_sol: float = 1.0, pubkey: Pubkey | None = None):
        # print(f"Using url: {self.client.}")
        pubkey = self.public_key if not pubkey else pubkey
        lamports = int(amount_sol * LAMPORTS_PER_SOL)  # 1 SOL = 1_000_000_000 lamports
        print(f"Requesting airdrop of {amount_sol} SOL ({lamports} lamports) to {pubkey}...")
        resp = await self.client.request_airdrop(pubkey, lamports)
        print(resp.value)
        if resp:
            signature = resp.value
            print(f"Airdrop requested. Signature: {signature}")

            await self.client.confirm_transaction(signature)
            print("Airdrop confirmed!")
        else:
            print("Airdrop failed:", resp)
    
    async def transfer_lamports(self, amount_sol: float, custom_pubkey: Pubkey | None = None):
        transfer_amount = int(amount_sol * LAMPORTS_PER_SOL)
        if not custom_pubkey:
            space = 0
            new_account = Keypair()

            rent_lamports = await self.client.get_minimum_balance_for_rent_exemption(space)

            create_account(
                CreateAccountParams(
                    from_pubkey=self.public_key,
                    to_pubkey=new_account.pubkey(),
                    lamports=rent_lamports.value,
                    space=space,
                    owner=self.public_key
                )
            )
            custom_pubkey = new_account.pubkey()

        latest_blockhash = await self.client.get_latest_blockhash()
        transfer_instruction = transfer(
            TransferParams(
                from_pubkey=self.public_key,
                to_pubkey=custom_pubkey,
                lamports=transfer_amount
            )
        )

        message = MessageV0.try_compile(
            payer=self.public_key,
            instructions=[transfer_instruction],
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash
        )

        transaction = VersionedTransaction(message, [self.keypair])
        resp = await self.client.send_transaction(transaction)
        await self.client.confirm_transaction(resp.value)
        print(f"Transaction signature: {resp.value}")

        print(f"Sender: {self.keypair.pubkey()}")
        print(f"Recipient: {custom_pubkey}")
        print(f"Transfer Amount: {transfer_amount / LAMPORTS_PER_SOL} SOL")
        print("Transaction submitted successfully!")
    
    async def get_balance(self, pub_key: Pubkey):
        resp = await self.client.get_balance(pub_key)
        if resp:
            lamports = resp.value
            sol = lamports / LAMPORTS_PER_SOL
            print(f"Wallet balance for {pub_key}: {sol} SOL ({lamports} lamports)")
            return sol
        else:
            print("Failed to fetch balance:", resp)
            return None
    
    async def transfer_all_lamports(self, recipient_pubkey: Pubkey):
        resp = await self.client.get_balance(self.public_key)
        if not resp:
            print("Failed to fetch balance:", resp)
            return

        lamports_balance = resp.value
        print(f"Current balance: {lamports_balance} lamports")

        space = 0
        rent_resp = await self.client.get_minimum_balance_for_rent_exemption(space)
        if not rent_resp:
            print("Failed to fetch rent-exemption:", rent_resp)
            return

        rent_lamports = rent_resp.value
        lamports_to_send = lamports_balance - rent_lamports - 5000
        if lamports_to_send <= 0:
            print("Not enough balance to transfer after rent and fees.")
            return

        transfer_ix = transfer(
            TransferParams(
                from_pubkey=self.public_key,
                to_pubkey=recipient_pubkey,
                lamports=lamports_to_send
            )
        )

        recent_blockhash_resp = await self.client.get_latest_blockhash()
        if not recent_blockhash_resp:
            print("Failed to get recent blockhash:", recent_blockhash_resp)
            return

        recent_blockhash = recent_blockhash_resp.value.blockhash
        message = MessageV0.try_compile(
            payer=self.public_key,
            instructions=[transfer_ix],
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash
        )
        transaction = VersionedTransaction(message, [self.keypair])

        resp = await self.client.send_transaction(transaction)
        if resp:
            print(f"All lamports transferred! Transaction signature: {resp.value}")
        else:
            print("Transaction failed:", resp)

async def main():
    print("Choose network:\n1. devnet\n2. local validator\n3. testnet")
    inp = int(input("Your choice: "))
    match inp:
        case 1:
            client = AsyncClient("https://api.devnet.solana.com", timeout=30)
        case 2:
            client = AsyncClient("http://127.0.0.1:8899", timeout=30)
        case 3:
            client = AsyncClient("https://api.testnet.solana.com", timeout=30)
        case _:
            client = AsyncClient("http://127.0.0.1:8899")
    keypair = Keypair()
    obj = SolanaWorker(keypair, client)

    while True:
        print("\nActions:")
        print("1. Create and save new wallet")
        print("2. Airdrop SOL to this wallet")
        print("3. Transfer SOL to another address")
        print("4. Check wallet balance")
        print("5. Transfer all lamports to another address")
        print("6. Exit")

        try:
            choice = int(input("Choose action: "))
        except ValueError:
            print("Please enter a valid number (1-6).")
            continue

        match choice:
            case 1:
                await obj.create_solana_wallet()
                print(f"Wallet created and saved! Public Key: {obj.public_key}")
            case 2:
                try:
                    pubkey = str(input("Enter public key or skip: "))
                    if pubkey:
                        public_key = Pubkey.from_string(pubkey)
                    else:
                        public_key = None

                    amount = float(input("Enter amount of SOL to airdrop: "))
                    if amount <= 0:
                        print("Amount must be greater than 0.")
                        continue
                    await obj.airdrop_sol(amount)
                except ValueError:
                    print("Please enter a valid number for amount.")
            case 3:
                try:
                    pubkey = str(input("Enter public key or skip: "))
                    if pubkey:
                        public_key = Pubkey.from_string(pubkey)
                    else:
                        public_key = None
        
                    amount = float(input("Enter amount of SOL to transfer: "))
                    if amount <= 0:
                        print("Amount must be greater than 0.")
                        continue
                    await obj.transfer_lamports(amount, public_key)
                except ValueError:
                    print("Please enter a valid number for amount.")
            case 4:
                pubkey = str(input("Enter public key: "))
                public_key = Pubkey.from_string(pubkey)
                await obj.get_balance(public_key)
            case 5:
                recipient = input("Enter recipient public key: ")
                await obj.transfer_all_lamports(Pubkey.from_string(recipient))
            case 6:
                print("Exiting...")
                break
            case _:
                print("Invalid choice, try again.")

if __name__ == "__main__":
    asyncio.run(main())
