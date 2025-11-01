"""Example client for the Anchor-based counter program."""

import asyncio
import json
from pathlib import Path
from typing import Optional

from anchorpy import Context, Idl, Program, Provider, Wallet
from anchorpy.error import AccountDoesNotExistError
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID

PROGRAM_ID = Pubkey.from_string("AFtX4cexdbori9CehN6sZH8Q9iRGfBBKnGNjNDzANyJM")
IDL_PATH = Path(__file__).with_name("counter") / "target" / "idl" / "counter.json"


def load_idl(path: Path) -> Idl:
    """Load the Anchor IDL, adapting field names to anchorpy's schema."""

    raw = json.loads(path.read_text())
    metadata = raw.get("metadata", {})
    raw.setdefault("name", metadata.get("name", "counter"))
    raw.setdefault("version", metadata.get("version", "0.1.0"))
    for ix in raw.get("instructions", []):
        for account_meta in ix.get("accounts", []):
            if "writable" in account_meta and "isMut" not in account_meta:
                account_meta["isMut"] = account_meta.pop("writable")
            if "signer" in account_meta and "isSigner" not in account_meta:
                account_meta["isSigner"] = account_meta.pop("signer")
            if "address" in account_meta and "pubkey" not in account_meta:
                account_meta["pubkey"] = account_meta.pop("address")
            account_meta.setdefault("isMut", False)
            account_meta.setdefault("isSigner", False)

    types_by_name = {t["name"]: t["type"] for t in raw.get("types", []) if "type" in t}
    for account_def in raw.get("accounts", []):
        if "type" not in account_def:
            candidate = types_by_name.get(account_def.get("name"))
            if candidate is not None:
                account_def["type"] = candidate
        if "type" in account_def:
            account_def["type"] = _normalize_types(account_def["type"])

    return Idl.from_json(json.dumps(raw))


def _normalize_types(node):
    """Recursively normalize type descriptors for anchorpy compatibility."""

    if isinstance(node, str):
        return "publicKey" if node == "pubkey" else node
    if isinstance(node, list):
        return [_normalize_types(item) for item in node]
    if not isinstance(node, dict):
        return node

    kind = node.get("kind")
    if kind == "struct":
        fields = node.get("fields", [])
        for field in fields:
            field["type"] = _normalize_types(field.get("type"))
        node["fields"] = fields
    elif kind in {"vec", "option"}:
        node["type"] = _normalize_types(node.get("type"))
    elif kind in {"array", "genericLenArray"}:
        node["array"] = _normalize_types(node.get("array"))
    elif kind == "defined" and "type" in node:
        node["type"] = _normalize_types(node.get("type"))

    return node


async def run_counter_task(program: Program, provider: Provider) -> Pubkey:
    """Initialize counter, increment thrice, decrement once, and report the result."""

    counter = Keypair()
    print(provider.wallet.public_key)
    print(f"\nInitializing counter account {counter.pubkey()}...")
    signature = await program.rpc["initialize"](
        ctx=Context(
            accounts={
                "counter": counter.pubkey(),
                "authority": provider.wallet.public_key,
                "system_program": SYS_PROGRAM_ID,
            },
            signers=[counter],
        ),
    )
    await provider.connection.confirm_transaction(signature)

    for index in range(3):
        print(f"Incrementing counter ({index + 1}/3)...")
        signature = await program.rpc["increment"](
            ctx=Context(
                accounts={
                    "counter": counter.pubkey(),
                    "authority": provider.wallet.public_key,
                }
            ),
        )
        await provider.connection.confirm_transaction(signature)

    print("Decrementing counter (1/1)...")
    signature = await program.rpc["decrement"](
        ctx=Context(
            accounts={
                "counter": counter.pubkey(),
                "authority": provider.wallet.public_key,
            }
        ),
    )
    await provider.connection.confirm_transaction(signature)

    account = await program.account["CounterAccount"].fetch(counter.pubkey())
    print(f"Counter value: {account.count}")

    return counter.pubkey()


async def show_counter_value(program: Program, last_counter: Optional[Pubkey]) -> None:
    """Prompt for a counter address and print its stored value."""

    raw_input = input(
        "Enter counter account pubkey (leave blank to use the last created): "
    ).strip()

    if raw_input:
        try:
            target_pubkey = Pubkey.from_string(raw_input)
        except ValueError:
            print("Invalid public key format.")
            return
    else:
        if last_counter is None:
            print("No counter recorded this session. Please enter a pubkey or run the task first.")
            return
        target_pubkey = last_counter

    try:
        account = await program.account["CounterAccount"].fetch(target_pubkey)
    except AccountDoesNotExistError:
        print("Counter account not found on this cluster.")
        return

    print(f"Counter {target_pubkey}: {account.count}")


async def main() -> None:
    if not IDL_PATH.exists():
        raise FileNotFoundError(
            "Counter IDL was not found. Run 'anchor build' inside Lab3/counter first."
        )

    print("Choose network:\n1. devnet\n2. local validator\n3. testnet")
    try:
        network_choice = int(input("Your choice: ").strip())
    except ValueError:
        network_choice = 2

    match network_choice:
        case 1:
            client = AsyncClient("https://api.devnet.solana.com", timeout=30)
        case 3:
            client = AsyncClient("https://api.testnet.solana.com", timeout=30)
        case _:
            client = AsyncClient("http://127.0.0.1:8899", timeout=30)

    wallet = Wallet.local()
    provider = Provider(client, wallet)

    idl = load_idl(IDL_PATH)
    program = Program(idl, PROGRAM_ID, provider)

    last_counter: Optional[Pubkey] = None

    try:
        while True:
            print("\nActions:")
            print("1. Run counter task (initialize, +3, -1)")
            print("2. Show counter value")
            print("3. Exit")

            choice = input("Choose action: ").strip()

            if choice == "1":
                last_counter = await run_counter_task(program, provider)
            elif choice == "2":
                await show_counter_value(program, last_counter)
            elif choice == "3":
                print("Exiting...")
                break
            else:
                print("Invalid choice, try again.")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
# 7K2qEoxmPoMjsB9jeRYa6DJKp4dSqvmDpt1TVSDaDXnZ - local counter account for testing
