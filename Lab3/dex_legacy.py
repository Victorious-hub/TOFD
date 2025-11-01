"""Async client for interacting with the fixed-rate DEX program."""

import asyncio
import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Optional

from anchorpy import Context, Idl, Program, Provider, Wallet
from anchorpy.error import AccountDoesNotExistError
from solana.publickey import PublicKey
from solana.rpc.async_api import AsyncClient
from solana.system_program import TransferParams, transfer
from solana.transaction import Transaction
from solders.pubkey import Pubkey
from solders.sysvar import RENT

try:
    from spl.token.instructions import (
        create_associated_token_account,
        get_associated_token_address,
        sync_native,
    )
except ImportError as exc:  # pragma: no cover - surface actionable guidance
    raise SystemExit(
        "spl.token is required. Install with `pip install spl-token` or `pip install anchorpy[spl-token]`."
    ) from exc


PROGRAM_ID = Pubkey.from_string("c37jV6isXMfR88okiAnRUcsMn5nD7HGLmcSEkq5zVJT")
DEX_IDL_PATH = Path(__file__).with_name("dex") / "target" / "idl" / "dex.json"
DEX_STATE_SEED = b"dex-state"
WSOL_MINT = Pubkey.from_string("So11111111111111111111111111111111111111112")
TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
SYSTEM_PROGRAM_ID = Pubkey.from_string("11111111111111111111111111111111")

LAMPORTS_PER_SOL = 1_000_000_000


@dataclass
class DexState:
    address: Pubkey
    authority: Pubkey
    mint: Pubkey
    wsol_mint: Pubkey
    token_vault: Pubkey
    wsol_vault: Pubkey
    rate_lamports_per_token: int
    mint_decimals: int
    bump: int

    @property
    def decimals_factor(self) -> Decimal:
        return Decimal(10) ** self.mint_decimals

    @property
    def rate_in_sol(self) -> Decimal:
        return Decimal(self.rate_lamports_per_token) / Decimal(LAMPORTS_PER_SOL)


def load_idl(path: Path) -> Idl:
    """Load and normalize the Anchor-generated IDL for anchorpy."""

    raw = json.loads(path.read_text())
    metadata = raw.get("metadata", {})
    raw.setdefault("name", metadata.get("name", "dex"))
    raw.setdefault("version", metadata.get("version", "0.1.0"))

    for instruction in raw.get("instructions", []):
        for account_meta in instruction.get("accounts", []):
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


def to_public_key(pubkey: Pubkey) -> PublicKey:
    return PublicKey(str(pubkey))


def to_program_pubkey(pubkey: PublicKey) -> Pubkey:
    return Pubkey.from_string(str(pubkey))


async def ensure_ata(provider: Provider, owner: Pubkey, mint: Pubkey) -> Pubkey:
    """Derive and create (if needed) the associated token account for owner/mint."""

    ata_pk = get_associated_token_address(to_public_key(owner), to_public_key(mint))
    ata = to_program_pubkey(ata_pk)
    info = await provider.connection.get_account_info(ata)
    if info.value is None:
        tx = Transaction()
        tx.add(
            create_associated_token_account(
                payer=to_public_key(provider.wallet.public_key),
                owner=to_public_key(owner),
                mint=to_public_key(mint),
            )
        )
    signature = await provider.send(tx)
    await provider.connection.confirm_transaction(signature)
        print(f"Created ATA {ata} for owner {owner} and mint {mint}.")
    return ata


async def wrap_sol(provider: Provider, lamports: int) -> Pubkey:
    """Wrap native SOL into WSOL by transferring lamports into the owner's WSOL ATA."""

    if lamports <= 0:
        raise ValueError("Lamports must be positive when wrapping SOL.")

    owner = provider.wallet.public_key
    wsol_ata = await ensure_ata(provider, owner, WSOL_MINT)

    tx = Transaction()
    tx.add(
        transfer(
            TransferParams(
                from_pubkey=to_public_key(owner),
                to_pubkey=to_public_key(wsol_ata),
                lamports=lamports,
            )
        )
    )
    tx.add(sync_native(to_public_key(wsol_ata)))

    signature = await provider.send(tx)
    await provider.connection.confirm_transaction(signature)
    print(f"Wrapped {Decimal(lamports) / Decimal(LAMPORTS_PER_SOL)} SOL into WSOL ATA {wsol_ata}.")
    return wsol_ata


async def fetch_state(program: Program, mint: Pubkey) -> Optional[DexState]:
    state_address, _ = Pubkey.find_program_address([DEX_STATE_SEED, bytes(mint)], PROGRAM_ID)
    try:
        raw_state = await program.account["DexState"].fetch(state_address)
    except AccountDoesNotExistError:
        return None

    return DexState(
        address=state_address,
        authority=raw_state.authority,
        mint=raw_state.mint,
        wsol_mint=raw_state.wsol_mint,
        token_vault=raw_state.token_vault,
        wsol_vault=raw_state.wsol_vault,
        rate_lamports_per_token=raw_state.rate_lamports_per_token,
        mint_decimals=raw_state.mint_decimals,
        bump=raw_state.bump,
    )


async def initialize_dex(program: Program, provider: Provider) -> None:
    mint_input = input("Token mint address: ").strip()
    if not mint_input:
        print("Token mint address is required.")
        return

    try:
        mint = Pubkey.from_string(mint_input)
    except ValueError:
        print("Invalid mint pubkey.")
        return

    try:
        token_liquidity = int(input("Token liquidity to deposit (raw units): ").strip())
        wsol_liquidity = Decimal(input("WSOL liquidity to deposit (in SOL): ").strip())
    except ValueError:
        print("Liquidity values must be numeric.")
        return

    if token_liquidity <= 0 or wsol_liquidity <= 0:
        print("Liquidity must be positive.")
        return

    wsol_lamports = int(wsol_liquidity * Decimal(LAMPORTS_PER_SOL))

    state_address, _ = Pubkey.find_program_address([DEX_STATE_SEED, bytes(mint)], PROGRAM_ID)
    token_vault = to_program_pubkey(
        get_associated_token_address(to_public_key(state_address), to_public_key(mint))
    )
    wsol_vault = to_program_pubkey(
        get_associated_token_address(to_public_key(state_address), to_public_key(WSOL_MINT))
    )

    payer = provider.wallet.public_key
    payer_token_ata = await ensure_ata(provider, payer, mint)
    payer_wsol_ata = await ensure_ata(provider, payer, WSOL_MINT)

    accounts = {
        "payer": payer,
        "mint": mint,
        "wsol_mint": WSOL_MINT,
        "state": state_address,
        "token_vault": token_vault,
        "wsol_vault": wsol_vault,
        "payer_token_ata": payer_token_ata,
        "payer_wsol_ata": payer_wsol_ata,
        "token_program": TOKEN_PROGRAM_ID,
        "system_program": SYSTEM_PROGRAM_ID,
        "rent": RENT,
        "associated_token_program": ASSOCIATED_TOKEN_PROGRAM_ID,
    }

    signature = await program.rpc["initialize"](
        token_liquidity,
        wsol_lamports,
        ctx=Context(accounts=accounts),
    )
    await provider.connection.confirm_transaction(signature)

    print("Initialization complete. DEX state:")
    state = await fetch_state(program, mint)
    if state:
        print_state(state)


async def buy_tokens(program: Program, provider: Provider) -> None:
    mint = await prompt_for_initialized_state(program)
    if mint is None:
        return

    try:
        wsol_in_sol = Decimal(input("WSOL amount to spend (in SOL): ").strip())
    except ValueError:
        print("Amount must be numeric.")
        return

    if wsol_in_sol <= 0:
        print("Amount must be positive.")
        return

    wsol_lamports = int(wsol_in_sol * Decimal(LAMPORTS_PER_SOL))

    state = await fetch_state(program, mint)
    assert state is not None  # already checked via prompt

    buyer = provider.wallet.public_key
    buyer_token_ata = await ensure_ata(provider, buyer, mint)
    buyer_wsol_ata = await ensure_ata(provider, buyer, WSOL_MINT)

    accounts = {
        "buyer": buyer,
        "mint": mint,
        "wsol_mint": WSOL_MINT,
        "state": state.address,
        "buyer_token_ata": buyer_token_ata,
        "buyer_wsol_ata": buyer_wsol_ata,
        "token_vault": state.token_vault,
        "wsol_vault": state.wsol_vault,
        "token_program": TOKEN_PROGRAM_ID,
    }

    signature = await program.rpc["buy"](
        wsol_lamports,
        ctx=Context(accounts=accounts),
    )
    await provider.connection.confirm_transaction(signature)

    expected_tokens = (Decimal(wsol_lamports) * state.decimals_factor) / Decimal(
        state.rate_lamports_per_token
    )
    print(
        f"Buy complete. Expected token amount (before rounding): {expected_tokens.normalize()}"
    )


async def sell_tokens(program: Program, provider: Provider) -> None:
    mint = await prompt_for_initialized_state(program)
    if mint is None:
        return

    try:
        token_amount = Decimal(input("Token amount to sell (raw units): ").strip())
    except ValueError:
        print("Amount must be numeric.")
        return

    if token_amount <= 0:
        print("Amount must be positive.")
        return

    token_raw = int(token_amount)
    if Decimal(token_raw) != token_amount:
        print("Amount must be an integer number of raw token units.")
        return

    state = await fetch_state(program, mint)
    assert state is not None

    seller = provider.wallet.public_key
    seller_token_ata = await ensure_ata(provider, seller, mint)
    seller_wsol_ata = await ensure_ata(provider, seller, WSOL_MINT)

    accounts = {
        "seller": seller,
        "mint": mint,
        "wsol_mint": WSOL_MINT,
        "state": state.address,
        "seller_token_ata": seller_token_ata,
        "seller_wsol_ata": seller_wsol_ata,
        "token_vault": state.token_vault,
        "wsol_vault": state.wsol_vault,
        "token_program": TOKEN_PROGRAM_ID,
    }

    signature = await program.rpc["sell"](
        token_raw,
        ctx=Context(accounts=accounts),
    )
    await provider.connection.confirm_transaction(signature)

    expected_lamports = (Decimal(token_raw) * state.rate_lamports_per_token) / state.decimals_factor
    print(
        f"Sell complete. Expected WSOL amount (before rounding): {expected_lamports / Decimal(LAMPORTS_PER_SOL)} SOL"
    )


async def prompt_for_initialized_state(program: Program) -> Optional[Pubkey]:
    mint_input = input("Token mint address: ").strip()
    if not mint_input:
        print("Token mint address is required.")
        return None

    try:
        mint = Pubkey.from_string(mint_input)
    except ValueError:
        print("Invalid mint pubkey.")
        return None

    state = await fetch_state(program, mint)
    if state is None:
        print("DEX state is not initialized for this mint.")
        return None

    print_state(state)
    return mint


def print_state(state: DexState) -> None:
    print(f" State PDA: {state.address}")
    print(f" Rate: {state.rate_in_sol} SOL per token")
    print(f" Mint decimals: {state.mint_decimals}")
    print(f" Token vault: {state.token_vault}")
    print(f" WSOL vault: {state.wsol_vault}")


async def show_balances(provider: Provider, mint: Pubkey) -> None:
    owner = provider.wallet.public_key
    token_ata = await ensure_ata(provider, owner, mint)
    wsol_ata = await ensure_ata(provider, owner, WSOL_MINT)

    token_balance = await provider.connection.get_token_account_balance(token_ata)
    wsol_balance = await provider.connection.get_token_account_balance(wsol_ata)

    print(f"Token ATA {token_ata}: {token_balance.value.ui_amount_string} tokens")
    print(f"WSOL ATA {wsol_ata}: {wsol_balance.value.ui_amount_string} SOL")


async def main() -> None:
    if not DEX_IDL_PATH.exists():
        raise FileNotFoundError(
            "DEX IDL not found. Run `anchor build` inside Lab3/dex before using the client."
        )

    print("Choose network:\n1. devnet\n2. local validator\n3. testnet")
    try:
        choice = int(input("Your choice: ").strip())
    except ValueError:
        choice = 2

    match choice:
        case 1:
            client = AsyncClient("https://api.devnet.solana.com", timeout=30)
        case 3:
            client = AsyncClient("https://api.testnet.solana.com", timeout=30)
        case _:
            client = AsyncClient("http://127.0.0.1:8899", timeout=30)

    wallet = Wallet.local()
    provider = Provider(client, wallet)
    idl = load_idl(DEX_IDL_PATH)
    program = Program(idl, PROGRAM_ID, provider)

    try:
        while True:
            print("\nActions:")
            print("1. Initialize DEX state")
            print("2. Buy tokens with WSOL")
            print("3. Sell tokens for WSOL")
            print("4. Wrap SOL into WSOL")
            print("5. Show balances")
            print("6. Exit")

            choice = input("Choose action: ").strip()

            if choice == "1":
                await initialize_dex(program, provider)
            elif choice == "2":
                await buy_tokens(program, provider)
            elif choice == "3":
                await sell_tokens(program, provider)
            elif choice == "4":
                try:
                    sol_amount = Decimal(input("SOL amount to wrap: ").strip())
                except ValueError:
                    print("Amount must be numeric.")
                    continue
                if sol_amount <= 0:
                    print("Amount must be positive.")
                    continue
                await wrap_sol(provider, int(sol_amount * Decimal(LAMPORTS_PER_SOL)))
            elif choice == "5":
                mint_input = input("Token mint address: ").strip()
                if not mint_input:
                    print("Token mint address is required.")
                    continue
                try:
                    mint = Pubkey.from_string(mint_input)
                except ValueError:
                    print("Invalid mint pubkey.")
                    continue
                await show_balances(provider, mint)
            elif choice == "6":
                print("Exiting...")
                break
            else:
                print("Invalid choice, try again.")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
