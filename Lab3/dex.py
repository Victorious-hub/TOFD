"""Client helper for the custom Anchor-based DEX program."""

from __future__ import annotations

import argparse
import asyncio
import json
from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN, getcontext
from pathlib import Path
from typing import Optional

from anchorpy import Context, Idl, Program, Provider, Wallet
from anchorpy.error import AccountDoesNotExistError
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
from solders.instruction import Instruction
from solders.keypair import Keypair
from solders.message import MessageV0
from solders.pubkey import Pubkey
from solders.signature import Signature
from solders.system_program import ID as SYS_PROGRAM_ID, TransferParams, transfer
from solders.transaction import VersionedTransaction
from spl.token.async_client import AsyncToken
from spl.token.constants import ASSOCIATED_TOKEN_PROGRAM_ID as SPL_ASSOCIATED_TOKEN_PROGRAM_ID
from spl.token.constants import TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID
from spl.token.constants import WRAPPED_SOL_MINT
from spl.token.instructions import (
	create_associated_token_account,
	get_associated_token_address,
	SyncNativeParams,
	sync_native,
)

getcontext().prec = 40

async def send_instructions(
	provider: Provider,
	instructions: list[Instruction],
	extra_signers: Optional[list[Keypair]] = None,
) -> Signature:
	blockhash_resp = await provider.connection.get_latest_blockhash()
	message = MessageV0.try_compile(
		payer=provider.wallet.public_key,
		instructions=instructions,
		address_lookup_table_accounts=[],
		recent_blockhash=blockhash_resp.value.blockhash,
	)
	signers = [provider.wallet.payer]
	if extra_signers:
		signers.extend(extra_signers)
	tx = VersionedTransaction(message, signers)
	resp = await provider.connection.send_transaction(tx)
	signature = resp.value
	await provider.connection.confirm_transaction(signature)
	return signature

LAMPORTS_PER_SOL = 1_000_000_000
DEX_PROGRAM_ID = Pubkey.from_string("c37jV6isXMfR88okiAnRUcsMn5nD7HGLmcSEkq5zVJT")
IDL_PATH = Path(__file__).with_name("dex") / "target" / "idl" / "dex.json"
RENT_SYSVAR_ID = Pubkey.from_string("SysvarRent111111111111111111111111111111111")
TOKEN_PROGRAM_ID = Pubkey.from_string(str(SPL_TOKEN_PROGRAM_ID))
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string(str(SPL_ASSOCIATED_TOKEN_PROGRAM_ID))
WSOL_MINT = Pubkey.from_string(str(WRAPPED_SOL_MINT))


def parse_ui_amount(value: str, decimals: int) -> int:
	quantizer = Decimal("1") / (Decimal(10) ** decimals)
	amount = Decimal(value).quantize(quantizer, rounding=ROUND_DOWN)
	scaled = int((amount * (10 ** decimals)).to_integral_value(rounding=ROUND_DOWN))
	if scaled < 0:
		raise ValueError("Amount must be non-negative")
	return scaled


def lamports_to_sol_str(lamports: int) -> str:
	return f"{Decimal(lamports) / Decimal(LAMPORTS_PER_SOL):f}"


def load_idl(path: Path) -> Idl:
	raw = json.loads(path.read_text())
	metadata = raw.get("metadata", {})
	raw.setdefault("name", metadata.get("name", "dex"))
	raw.setdefault("version", metadata.get("version", "0.1.0"))

	for ix in raw.get("instructions", []):
		for account_meta in ix.get("accounts", []):
			if "writable" in account_meta and "isMut" not in account_meta:
				account_meta["isMut"] = account_meta.pop("writable")
			if "signer" in account_meta and "isSigner" not in account_meta:
				account_meta["isSigner"] = account_meta.pop("signer")
			if "address" in account_meta and "pubkey" not in account_meta:
				account_meta["pubkey"] = account_meta.pop("address")
			if "pda" in account_meta:
				account_meta.pop("pda")
			account_meta.setdefault("isMut", False)
			account_meta.setdefault("isSigner", False)

	types_by_name = {
		entry["name"]: entry["type"]
		for entry in raw.get("types", [])
		if "type" in entry and "name" in entry
	}
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


def _read_keypair(path: Path) -> Keypair:
	data = json.loads(path.read_text())
	if isinstance(data, list):
		secret = bytes(data)
	elif isinstance(data, dict) and "secretKey" in data:
		secret = bytes(data["secretKey"])
	else:
		raise ValueError("Unsupported keypair file format; expected array of integers")

	keypair = Keypair.from_bytes(secret)
	return keypair


def load_wallet(path: Optional[Path]) -> Wallet:
	if path is None:
		default_path = Path(__file__).with_name("wallet.json")
		if default_path.exists():
			keypair = _read_keypair(default_path)
			return Wallet(keypair)
		return Wallet.local()

	keypair = _read_keypair(path)
	return Wallet(keypair)


@dataclass
class DerivedAddresses:
	state: Pubkey
	token_vault: Pubkey
	wsol_vault: Pubkey


def derive_addresses(mint: Pubkey) -> DerivedAddresses:
	state, _ = Pubkey.find_program_address(
		[b"dex-state", bytes(mint)],
		DEX_PROGRAM_ID,
	)
	token_vault = get_associated_token_address(state, mint)
	wsol_vault = get_associated_token_address(state, WSOL_MINT)
	return DerivedAddresses(
		state=state,
		token_vault=token_vault,
		wsol_vault=wsol_vault,
	)


async def ensure_ata(
	provider: Provider,
	owner: Pubkey,
	mint: Pubkey,
	min_balance: int = 0,
) -> Pubkey:
	ata = get_associated_token_address(owner, mint)

	info = await provider.connection.get_account_info(ata)
	if info.value is None:
		ix = create_associated_token_account(
			provider.wallet.public_key,
			owner,
			mint,
		)
		await send_instructions(provider, [ix])

	if min_balance > 0:
		balance_resp = await provider.connection.get_token_account_balance(ata)
		current = int(balance_resp.value.amount) if balance_resp.value else 0
		if current < min_balance:
			raise ValueError(
				f"Token account {ata} holds {current} but {min_balance} required"
			)

	return ata


async def ensure_wsol(
	provider: Provider,
	owner: Pubkey,
	required_lamports: int,
	*,
	auto_wrap: bool,
) -> Pubkey:
	ata = get_associated_token_address(owner, WSOL_MINT)

	info = await provider.connection.get_account_info(ata)
	current = 0
	instructions = []

	if info.value is None:
		instructions.append(
			create_associated_token_account(
				provider.wallet.public_key,
				owner,
				WSOL_MINT,
			)
		)
	else:
		balance_resp = await provider.connection.get_token_account_balance(ata)
		current = int(balance_resp.value.amount)

	missing = required_lamports - current
	if missing > 0:
		if not auto_wrap:
			raise ValueError(
				f"WSOL balance {current} is below required {required_lamports}. "
				"Re-run with --auto-wrap or wrap manually."
			)
		instructions.append(
			transfer(
				TransferParams(
						from_pubkey=provider.wallet.public_key,
						to_pubkey=ata,
					lamports=missing,
				)
			)
		)
		instructions.append(sync_native(SyncNativeParams(account=ata)))

	if instructions:
		await send_instructions(provider, instructions)

	return ata


async def fetch_mint_decimals(provider: Provider, mint: Pubkey) -> int:
	token = AsyncToken(
		provider.connection,
		mint,
		TOKEN_PROGRAM_ID,
		provider.wallet.payer,
	)
	info = await token.get_mint_info()
	return info.decimals


async def fetch_state(program: Program, mint: Pubkey) -> tuple[Pubkey, dict]:
	addresses = derive_addresses(mint)
	account = await program.account["DexState"].fetch(addresses.state)
	return addresses.state, {
		"authority": account.authority,
		"mint": account.mint,
		"wsol_mint": account.wsol_mint,
		"token_vault": account.token_vault,
		"wsol_vault": account.wsol_vault,
		"rate_lamports_per_token": account.rate_lamports_per_token,
		"mint_decimals": account.mint_decimals,
		"bump": account.bump,
	}


def compute_tokens_for_lamports(lamports: int, rate: int, decimals: int) -> int:
	numerator = lamports * (10 ** decimals)
	return numerator // rate


def compute_lamports_for_tokens(tokens: int, rate: int, decimals: int) -> int:
	numerator = tokens * rate
	return numerator // (10 ** decimals)


async def cmd_initialize(args, program: Program, provider: Provider) -> None:
	mint = Pubkey.from_string(args.mint)
	decimals = await fetch_mint_decimals(provider, mint)
	token_liquidity = parse_ui_amount(args.token_amount, decimals)
	wsol_liquidity = parse_ui_amount(args.wsol_amount, 9)

	addresses = derive_addresses(mint)

	try:
		await program.account["DexState"].fetch(addresses.state)
		raise RuntimeError("DEX already initialized for this mint")
	except AccountDoesNotExistError:
		pass

	payer_token_ata = await ensure_ata(provider, provider.wallet.public_key, mint, token_liquidity)
	payer_wsol_ata = await ensure_wsol(
		provider,
		provider.wallet.public_key,
		wsol_liquidity,
		auto_wrap=args.auto_wrap,
	)

	ctx = Context(
		accounts={
			"payer": provider.wallet.public_key,
			"mint": mint,
			"wsol_mint": WSOL_MINT,
			"state": addresses.state,
			"token_vault": addresses.token_vault,
			"wsol_vault": addresses.wsol_vault,
			"payer_token_ata": payer_token_ata,
			"payer_wsol_ata": payer_wsol_ata,
			"token_program": TOKEN_PROGRAM_ID,
			"system_program": SYS_PROGRAM_ID,
			"rent": RENT_SYSVAR_ID,
			"associated_token_program": ASSOCIATED_TOKEN_PROGRAM_ID,
		}
	)

	sig = await program.rpc["initialize"](token_liquidity, wsol_liquidity, ctx=ctx)
	await provider.connection.confirm_transaction(sig)

	state = await program.account["DexState"].fetch(addresses.state)

	print("Initialized DEX state")
	print(f"  state: {addresses.state}")
	print(f"  token vault: {addresses.token_vault}")
	print(f"  wsol vault: {addresses.wsol_vault}")
	print(
		"  rate: 1 token -> "
		f"{lamports_to_sol_str(state.rate_lamports_per_token)} SOL"
	)
	print(f"  signature: {sig}")


async def cmd_buy(args, program: Program, provider: Provider) -> None:
	mint = Pubkey.from_string(args.mint)
	addresses = derive_addresses(mint)
	_, state = await fetch_state(program, mint)

	wsol_amount = parse_ui_amount(args.sol_amount, 9)
	tokens_expected = compute_tokens_for_lamports(
		wsol_amount,
		state["rate_lamports_per_token"],
		state["mint_decimals"],
	)

	buyer_token_ata = await ensure_ata(provider, provider.wallet.public_key, mint)
	buyer_wsol_ata = await ensure_wsol(
		provider,
		provider.wallet.public_key,
		wsol_amount,
		auto_wrap=args.auto_wrap,
	)

	ctx = Context(
		accounts={
			"buyer": provider.wallet.public_key,
			"mint": mint,
			"wsol_mint": WSOL_MINT,
			"state": addresses.state,
			"buyer_token_ata": buyer_token_ata,
			"buyer_wsol_ata": buyer_wsol_ata,
			"token_vault": addresses.token_vault,
			"wsol_vault": addresses.wsol_vault,
			"token_program": TOKEN_PROGRAM_ID,
		}
	)

	sig = await program.rpc["buy"](wsol_amount, ctx=ctx)
	await provider.connection.confirm_transaction(sig)

	print("Buy executed")
	print(f"  spent: {lamports_to_sol_str(wsol_amount)} SOL")
	print(f"  expected tokens: {Decimal(tokens_expected) / (Decimal(10) ** state['mint_decimals']):f}")
	print(f"  signature: {sig}")


async def cmd_sell(args, program: Program, provider: Provider) -> None:
	mint = Pubkey.from_string(args.mint)
	addresses = derive_addresses(mint)
	_, state = await fetch_state(program, mint)

	token_amount = parse_ui_amount(args.token_amount, state["mint_decimals"])
	lamports_expected = compute_lamports_for_tokens(
		token_amount,
		state["rate_lamports_per_token"],
		state["mint_decimals"],
	)

	seller_token_ata = await ensure_ata(
		provider,
		provider.wallet.public_key,
		mint,
		token_amount,
	)
	seller_wsol_ata = await ensure_ata(
		provider,
		provider.wallet.public_key,
		WSOL_MINT,
	)

	ctx = Context(
		accounts={
			"seller": provider.wallet.public_key,
			"mint": mint,
			"wsol_mint": WSOL_MINT,
			"state": addresses.state,
			"seller_token_ata": seller_token_ata,
			"seller_wsol_ata": seller_wsol_ata,
			"token_vault": addresses.token_vault,
			"wsol_vault": addresses.wsol_vault,
			"token_program": TOKEN_PROGRAM_ID,
		}
	)

	sig = await program.rpc["sell"](token_amount, ctx=ctx)
	await provider.connection.confirm_transaction(sig)

	print("Sell executed")
	print(
		f"  tokens sold: {Decimal(token_amount) / (Decimal(10) ** state['mint_decimals']):f}"
	)
	print(f"  received SOL: {lamports_to_sol_str(lamports_expected)}")
	print(f"  signature: {sig}")


async def cmd_state(args, program: Program, provider: Provider) -> None:
	mint = Pubkey.from_string(args.mint)
	addresses = derive_addresses(mint)
	try:
		raw = await program.account["DexState"].fetch(addresses.state)
	except AccountDoesNotExistError:
		print("DEX state not found for this mint")
		return

	print("DEX state")
	print(f"  state: {addresses.state}")
	print(f"  authority: {raw.authority}")
	print(f"  token mint: {raw.mint}")
	print(f"  wsol mint: {raw.wsol_mint}")
	print(f"  token vault: {raw.token_vault}")
	print(f"  wsol vault: {raw.wsol_vault}")
	print(
		"  rate: 1 token -> "
		f"{lamports_to_sol_str(raw.rate_lamports_per_token)} SOL"
	)
	print(f"  decimals: {raw.mint_decimals}")


def build_parser() -> argparse.ArgumentParser:
	parser = argparse.ArgumentParser(description="Interact with the custom DEX program")
	parser.add_argument(
		"command",
		choices={"init", "buy", "sell", "state"},
		help="Action to perform",
	)
	parser.add_argument("--rpc", dest="rpc_url", help="Custom RPC URL")
	parser.add_argument(
		"--cluster",
		choices={"devnet", "local", "testnet"},
		default="local",
		help="Shortcut for common clusters",
	)
	parser.add_argument(
		"--commitment",
		choices={"processed", "confirmed", "finalized"},
		default="confirmed",
		help="RPC commitment level",
	)
	parser.add_argument(
		"--keypair",
		type=Path,
		help="Path to keypair file (defaults to ANCHOR_WALLET or ~/.config/solana/id.json)",
	)
	parser.add_argument("--mint", required=True, help="Token mint address")
	parser.add_argument(
		"--auto-wrap",
		action="store_true",
		help="Automatically wrap SOL when WSOL is required",
	)

	parser.add_argument("--token-amount", help="Token amount (init/sell)")
	parser.add_argument("--wsol-amount", help="WSOL amount in SOL units (init)")
	parser.add_argument("--sol-amount", help="SOL amount to spend (buy)")

	return parser


def resolve_rpc(cluster: str, override: Optional[str]) -> str:
	if override:
		return override
	if cluster == "devnet":
		return "https://api.devnet.solana.com"
	if cluster == "testnet":
		return "https://api.testnet.solana.com"
	return "http://127.0.0.1:8899"


async def async_main() -> None:
	if not IDL_PATH.exists():
		raise FileNotFoundError(
			"DEX IDL not found. Run 'anchor build' inside Lab3/dex first."
		)

	parser = build_parser()
	args = parser.parse_args()

	rpc_url = resolve_rpc(args.cluster, args.rpc_url)
	commitment: Commitment = args.commitment  # type: ignore[assignment]

	client = AsyncClient(rpc_url, commitment=commitment, timeout=30)
	wallet = load_wallet(args.keypair)
	provider = Provider(client, wallet)

	idl = load_idl(IDL_PATH)
	program = Program(idl, DEX_PROGRAM_ID, provider)

	try:
		if args.command == "init":
			if not args.token_amount or not args.wsol_amount:
				raise SystemExit("--token-amount and --wsol-amount are required for init")
			await cmd_initialize(args, program, provider)
		elif args.command == "buy":
			if not args.sol_amount:
				raise SystemExit("--sol-amount is required for buy")
			await cmd_buy(args, program, provider)
		elif args.command == "sell":
			if not args.token_amount:
				raise SystemExit("--token-amount is required for sell")
			await cmd_sell(args, program, provider)
		elif args.command == "state":
			await cmd_state(args, program, provider)
		else:
			raise SystemExit("Unknown command")
	finally:
		await client.close()


def main() -> None:
	asyncio.run(async_main())


if __name__ == "__main__":
	main()
