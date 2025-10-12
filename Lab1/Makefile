run:
	solana-test-validator

create-wallet:
	solana-keygen new --outfile $(file) --force && solana config set --keypair $(file)

set-url:
	solana config set --url $(url)

solana-address:
	solana address

solana-balance:
	solana balance

solana-airdrop:
	solana airdrop $(amount)

solana-config:
	solana config get

solana-transfer:
	solana transfer 3EUpbhsQhFctEZYiT295ccBhFioQp8XaoZcEnT41Aazu 1 --allow-unfunded-recipient

solana-account-balance:
	solana balance -k $(file)
#  FnnWH2arNGAjrPKmeFja53s43ZaBDcp69SUB8VPTj94M