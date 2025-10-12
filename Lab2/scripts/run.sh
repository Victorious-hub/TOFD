# npx tsx wsol.ts
# (venv) shyskov@Shyskov:~/Solana/Lab2/scripts$ npx tsx wsol.ts
# bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
# Wrapped SOL tx: 4rzwFZUh3KYKKkwkCa6D1xPqq8UJKoaMghkUBd391wD7JJJ7ZkjrjMWn1duh3BEm8fcmVMzrwisxtxnoWdwjkmnJ
# WSOL ATA: 8Weamv9mSzw5Wq1iqXL5ahJ5S91oj1Yfb3XzMT19mDnH

# npx tsx wrap-sol.ts
# bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
# Wrapped SOL signature: 2pXb1QXXGT8AJkNgeEU2JKy72dnU7knaAfDAdyy5fjKjv9HL8b6xvCxUtsidwLNnGeBjQ5cH5gRYDgYn3NZReWQw
# WSOL Associated Token Address: 8Weamv9mSzw5Wq1iqXL5ahJ5S91oj1Yfb3XzMT19mDnH


export NEW_WALLET_COUNT='3'
export NEW_WALLET_TOKEN_AMOUNT='10'
export NEW_WALLET_AIRDROP_SOL='0.25'
npm run create-wallets


export POOL_TOKEN_AMOUNT='100'       # token units (human-readable)
export POOL_WSOL_AMOUNT='1.5'        # SOL units to pair with tokens
export POOL_FEE_CONFIG_INDEX='0'     # pick 0–4 from getCpmmConfigs
npm run create-raydium-pool



bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
simulate tx string: [
  'AcyOKki1+EuYLO8GRX4L3keeaJCW9YH3XxE3xlUAAHXwTfgHCRmqqYiB9BgeHwT2+oFCexjY0SStRY3Pnu9CPAIBAAkTMMHcPUjRFMNAhlKygXu+YJdwgTf4dhB0DR4Nfx0mZV0ernxus9ME/aHBv4ppyT9y5FHA9NJyc90URF/1Ax1B3imO3uA+vivWQpiMrUi3emEXz+ucGNObFOGR9eRXDVa6KqkXM9jmynkz4RVo0uVKlNDZuXuG2EcDIdlg/3IktNOdcp51jD749lW27vFphROty+unD01cZEcBEGo9XoB0XZxDh19R4aCWIE6ulWDEuiGnLjSA9RVAyfIyc4LiX7k9trwPrl43ejGEGAiQWFmqCANHzFX6KroX7ajvy2Gdxme4tKYtEGYxOVlc9UiB+hgAzyAFIxhATT+nI7OPG2Vi3e3rt+T3caP6OZSKQCdww3hfk8ZeJzq/PcVsKpXMYBDEDcFvGZd6nmcWNtA594phzgmP6sO3TPiA1+1P40+NLXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACBpboUTIiukhZmlfV6nPpth7OsZUUq99hi4MR6SF+KtQMzvuVweKXZ7bgMWhVmguPgp2Hi2GUcJM+6KSkh2PIyMlyWPTiSJ8bs9ECkUjg2DC1oTmdr/EIQEjnvY2+n4WatTq3cnJMrwtqFQ1VziyM8wLlGhrq/KxUKMmnQz2fcquJiZeS3KUjR5b+d0YrAx30Y/X/6uNnxcD/skbhy3zgwGm4hX/quBhPtof2NGGMA12sQ53BrrO1WYoPAAAAAAAQan1RcZLFxRIYzJTD1K8X9Y2u4Im6H9ROPb2YoAAAAABt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKku4wtaAxUgTorAoaKZ/g6rXZlajHCTn81RjFfq3X2FpQQKAgAIfAMAAAAwwdw9SNEUw0CGUrKBe75gl3CBN/h2EHQNHg1/HSZlXSAAAAAAAAAANWJRWXRWM0JDd3ZIWFNOVnFRM1Z5eDF0WHIydjdGdWjwguwdAAAAAKUAAAAAAAAABt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKkSBAgQABEBAQ8UAAwOCRALAwgBBgUHAgQSEhINChEgr69tHw2Ym+0AZc0dAAAAAGQAAAAAAAAAfKPraAAAAAASAwgAAAEJ'
]
Raydium pool created.
Transaction: 56CoixNRhveNkricjg9SioF5KG3xP8UNRLAKzw7CjZundySQm32qKFqEsTzp6dsqCt4hB3AnytNt5eMPnLqZVYY1
Pool address: vhNhMzUYBJAqk9HawDxmVWwoYn2YuU53a1oV7fz3jQv
Vault A: BWzKmoPHL7ozqG6Y1TLMjBLmNkgf5wet5KGVUnekTMkG
Vault B: DS1nSKp22SiZgLsYYo5jmLcEYAPxZgtBvnZUV7JorEsE
LP mint: 3sXfjtLGpdWer4aTn9n3soePHPsmhqj5ysgymb8NxH8v



(venv) shyskov@Shyskov:~/Solana/Lab2$ spl-token accounts
Token                                         Balance
-----------------------------------------------------
So11111111111111111111111111111111111111112   1.5
3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg  0  

(venv) shyskov@Shyskov:~/Solana/Lab2$ spl-token create-account 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg
Creating account 34mYk6Lq1iuKTRFct4fS6vKNr2P8KtMk8uKy8tYJsLHK
Error: "Error: Account already exists: 34mYk6Lq1iuKTRFct4fS6vKNr2P8KtMk8uKy8tYJsLHK"
(venv) shyskov@Shyskov:~/Solana/Lab2$ spl-token mint 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg 1 34mYk6Lq1iuKTRFct4fS6vKNr2P8KtMk8uKy8tYJsLHK
Minting 1 tokens
  Token: 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg
  Recipient: 34mYk6Lq1iuKTRFct4fS6vKNr2P8KtMk8uKy8tYJsLHK

Signature: 4jR5rRTdyTjmwomUYDxwBj2dfypXx37r78QSAC6u4MooY5k239Zcj1Tmr3Ymz8oDY1uLpJcZZ7kdGLvqkdBt6Uso

(venv) shyskov@Shyskov:~/Solana/Lab2$ spl-token accounts
Token                                         Balance
-----------------------------------------------------
So11111111111111111111111111111111111111112   1.5
3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg  1  34mYk6Lq1iuKTRFct4fS6vKNr2P8KtMk8uKy8tYJsLHK



# execute Raydium swap
export SWAP_POOL_ID='n31RfhgF7z2jbUbyrF2NdT451rvPZr1p36StiXRkWFQ'
export SWAP_DIRECTION='token-to-wsol' # or wsol-to-token
export SWAP_AMOUNT='1'
export SWAP_SLIPPAGE_BPS='50'          # 0.50% tolerance
npm run swap


bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
Preparing Raydium CPMM swap:
  Pool: vhNhMzUYBJAqk9HawDxmVWwoYn2YuU53a1oV7fz3jQv
  Direction: token-to-wsol
  Input: 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg 1 (100 raw)
  Expected output: So11111111111111111111111111111111111111112 0.247474747 (247474747 raw)
  Minimum output (after slippage): 0.246237373 (246237373 raw)
simulate tx string: [
  'AZOLTbM7nCPVzCU/JvobpCmuAhZNPai8FImMxeMix/nMk2PGlBUWIB/vd+UoXDmVq0sDJkyukD1E3mTk7FF9dggBAAgPMMHcPUjRFMNAhlKygXu+YJdwgTf4dhB0DR4Nfx0mZV0ernxus9ME/aHBv4ppyT9y5FHA9NJyc90URF/1Ax1B3nTDgPDezhmOD/qb+DbrNmF8ZinAT2xzVhJ/iy0vWlpenXKedYw++PZVtu7xaYUTrcvrpw9NXGRHARBqPV6AdF2cQ4dfUeGgliBOrpVgxLohpy40gPUVQMnyMnOC4l+5Pbi0pi0QZjE5WVz1SIH6GADPIAUjGEBNP6cjs48bZWLdDcFvGZd6nmcWNtA594phzgmP6sO3TPiA1+1P40+NLXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACBpboUTIiukhZmlfV6nPpth7OsZUUq99hi4MR6SF+KtQMzvuVweKXZ7bgMWhVmguPgp2Hi2GUcJM+6KSkh2PIyrU6t3JyTK8LahUNVc4sjPMC5Roa6vysVCjJp0M9n3KriYmXktylI0eW/ndGKwMd9GP1/+rjZ8XA/7JG4ct84MBpuIV/6rgYT7aH9jRhjANdrEOdwa6ztVmKDwAAAAAAEGp9UXGSxcUSGMyUw9SvF/WNruCJuh/UTj29mKAAAAAAbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCplkaHVEkUES2v/MDPnWfz1XK5O6CyhZ9buwhnEU686o4EBwIAAnwDAAAAMMHcPUjRFMNAhlKygXu+YJdwgTf4dhB0DR4Nfx0mZV0gAAAAAAAAAEVXVHVpWGVrMXBrMTZpd2tuZ0Vtbjd4elhXbmVBOTFZ8B0fAAAAAAClAAAAAAAAAAbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpDgQCDAANAQELDQAKCQYBAgUEDg4IDAMYj75a2sQeM95kAAAAAAAAAL1IrQ4AAAAADgMCAAABCQ=='
]
Swap signature: 3x6Q2kLfc62T3HuXge3zEjjW8kDwjfEhkCQEQfKqA1jTPg2cpxg9UEiLqQf258TpaXbVig7tqkY6HVL46WRBo5kj

'Program log: Instruction: TransferChecked',
'Program log: Error: insufficient funds',
'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

# Если не хватит бабок 
(venv) shyskov@Shyskov:~/Solana/Lab2$ spl-token mint 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg 10 34mYk6Lq1iuKTRFct4fS6vKNr2P8KtMk8uKy8tYJsLHK
Minting 10 tokens
  Token: 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg
  Recipient: 34mYk6Lq1iuKTRFct4fS6vKNr2P8KtMk8uKy8tYJsLHK

Signature: 4hKAgcQxyA26ej4pZpZPzwAe6QcQCTWGoZ22nj2hbA1uQf6jBTfSPYeFZHafUr4QpmGRCrTJrw4BZNhK4YavbRmx


export SWAP_AMOUNT='0.1' 
npm run swap


bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
Preparing Raydium CPMM swap:
  Pool: vhNhMzUYBJAqk9HawDxmVWwoYn2YuU53a1oV7fz3jQv
  Direction: token-to-wsol
  Input: 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg 0.1 (10 raw)
  Expected output: So11111111111111111111111111111111111111112 0.009663703 (9663703 raw)
  Minimum output (after slippage): 0.009615384 (9615384 raw)
simulate tx string: [
  'AeGHuK483C+kK2oR3U5MuOLzvckGkBYtL8yXyKZXyoJzpUwmkxzM2FNrnEU9KjpNerQW197mGFEuXy+03AHmHgQBAAgPMMHcPUjRFMNAhlKygXu+YJdwgTf4dhB0DR4Nfx0mZV0ernxus9ME/aHBv4ppyT9y5FHA9NJyc90URF/1Ax1B3p1ynnWMPvj2Vbbu8WmFE63L66cPTVxkRwEQaj1egHRdnEOHX1HhoJYgTq6VYMS6IacuNID1FUDJ8jJzguJfuT24tKYtEGYxOVlc9UiB+hgAzyAFIxhATT+nI7OPG2Vi3b+o3uqwvRC7PGZ8SdzS0mWjDfuFTBKf/5n2mjGHFoLfDcFvGZd6nmcWNtA594phzgmP6sO3TPiA1+1P40+NLXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACBpboUTIiukhZmlfV6nPpth7OsZUUq99hi4MR6SF+KtQMzvuVweKXZ7bgMWhVmguPgp2Hi2GUcJM+6KSkh2PIyrU6t3JyTK8LahUNVc4sjPMC5Roa6vysVCjJp0M9n3KriYmXktylI0eW/ndGKwMd9GP1/+rjZ8XA/7JG4ct84MBpuIV/6rgYT7aH9jRhjANdrEOdwa6ztVmKDwAAAAAAEGp9UXGSxcUSGMyUw9SvF/WNruCJuh/UTj29mKAAAAAAbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpd5UQtDtOLlItqyAoRPj9xuxqNN9FOJYxxrNCVf0RUqgEBwIABXwDAAAAMMHcPUjRFMNAhlKygXu+YJdwgTf4dhB0DR4Nfx0mZV0gAAAAAAAAADhKWkwzaFJmWGhTTnYyQlg1akh3TlNXSDYzQWdHb3U48B0fAAAAAAClAAAAAAAAAAbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpDgQFDAANAQELDQAKCQYBBQQDDg4IDAIYj75a2sQeM94KAAAAAAAAABi4kgAAAAAADgMFAAABCQ=='
]
Swap signature: 5WXWiymQNkCrvnddJTrKVfhNEUgLZYpnC7fVm7FctNWzWH4gTieoTfBeruoJsef9LNLXJMYVvZcuzyiCriLVoYqy


export TOKEN_POOL_ID='n31RfhgF7z2jbUbyrF2NdT451rvPZr1p36StiXRkWFQ'
npm run prices


bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)
⚠️  Crypto.SOL/USD status is Unknown – using latest available price.
⚠️  Crypto.BTC/USD status is Unknown – using latest available price.
⚠️  Crypto.ETH/USD status is Unknown – using latest available price.
⚠️  Crypto.USDC/USD status is Unknown – using latest available price.
Pyth oracle prices (USD):
  SOL: $139.81741 ± 0.03495 (Crypto.SOL/USD)
  BTC: $59553.475 ± 14.89 (Crypto.BTC/USD)
  ETH: $2529.6700 ± 0.7800 (Crypto.ETH/USD)
  USDC: $0.99976000 ± 0.0002900 (Crypto.USDC/USD)

Derived token pricing:
  Token mint: 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg
  Pool: vhNhMzUYBJAqk9HawDxmVWwoYn2YuU53a1oV7fz3jQv
  Price in WSOL: 0.11449364 WSOL
  Price in USDC: $16.012047 (via WSOL→USDC)
  Price in USD: $16.008204
  Price in BTC: 0.00026880386 BTC
  Price in ETH: 0.0063281788 ETH