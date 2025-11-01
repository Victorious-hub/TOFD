cd /home/shyskov/Solana/Lab3 && anchor init dex


cd /home/shyskov/Solana/Lab3/dex && anchor build

cd Lab3/dex
anchor keys list   # confirm deploy keypair
anchor deploy --provider.cluster devnet --program-name dex

Check its balance: 
    solana balance ~/.config/solana/id.json --url https://api.devnet.solana.com (you’ll likely see ~2.07 SOL).
Airdrop or transfer a few SOL to that keypair (e.g. 
    solana airdrop 5 ~/.config/solana/id.json --url https://api.devnet.solana.com). If the faucet rate-limits you, send SOL from your funded wallet 4HL2C5M2p2Xq9wPdWFBgpcLiBCQSCb4xiTCn82MmP5ZW.
Once the balance covers the required 2.07005016 SOL plus fees, re-run
     anchor deploy --provider.cluster devnet --program-name dex.
After the program is live, the client init should work.

anchor deploy --provider.cluster devnet --program-name dex


(venv) shyskov@Shyskov:~/Solana/Lab3$ python dex.py init \
  --mint 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg \
  --token-amount 1 \
  --wsol-amount 1 \
  --cluster devnet \
  --auto-wrap
Initialized DEX state
  state: 4y9MbA6EGKz2fGW54CUsfPAgKukMNu2EK73MZAr16Tt1
  token vault: 4UpwayTNDjbGG2W5MFueXY16F2MK96Kzenwgsji7UXhk
  wsol vault: D6KVW7e81oSgArUsdjyfME1ZVhaFqe9pAbv8nb2gNBKq
  rate: 1 token -> 0.5 SOL
  signature: 4fuX2rgeX81eSsCVPeY9bQ8upQjDfDrWRFkgvViVeLFwz3RqCyapi6aREKdd4gNH7SwUcHDJRjgxHzLU9hndSmoX
(venv) shyskov@Shyskov:~/Solana/Lab3$ python dex.py state --mint 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg --cluster devnet
DEX state
  state: 4y9MbA6EGKz2fGW54CUsfPAgKukMNu2EK73MZAr16Tt1
  authority: 4HL2C5M2p2Xq9wPdWFBgpcLiBCQSCb4xiTCn82MmP5ZW
  token mint: 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg
  wsol mint: So11111111111111111111111111111111111111112
  token vault: 4UpwayTNDjbGG2W5MFueXY16F2MK96Kzenwgsji7UXhk
  wsol vault: D6KVW7e81oSgArUsdjyfME1ZVhaFqe9pAbv8nb2gNBKq
  rate: 1 token -> 0.5 SOL
  decimals: 2















  (venv) shyskov@Shyskov:~/Solana/Lab3$ python3 dex.py state --mint 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg --cluster devnet
DEX state
  state: 4y9MbA6EGKz2fGW54CUsfPAgKukMNu2EK73MZAr16Tt1
  authority: 4HL2C5M2p2Xq9wPdWFBgpcLiBCQSCb4xiTCn82MmP5ZW
  token mint: 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg
  wsol mint: So11111111111111111111111111111111111111112
  token vault: 4UpwayTNDjbGG2W5MFueXY16F2MK96Kzenwgsji7UXhk
  wsol vault: D6KVW7e81oSgArUsdjyfME1ZVhaFqe9pAbv8nb2gNBKq
  rate: 1 token -> 0.5 SOL
  decimals: 2
(venv) shyskov@Shyskov:~/Solana/Lab3$ python dex.py sell \
  --mint 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg \
  --token-amount 0.5 \
  --cluster devnet
Sell executed
  tokens sold: 0.5
  received SOL: 0.25
  signature: 3fjwRZhExc6eTfWbwLypjsXujZQFfbQwHsvbfJjNC1iujZVa9BvAcevBfMY3jH4Upthyx2ajnw29EWft5gQwRTcy
(venv) shyskov@Shyskov:~/Solana/Lab3$ python dex.py buy \
  --mint 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg \
  --sol-amount 0.25 \
  --cluster devnet \
  --auto-wrap
Buy executed
  spent: 0.25 SOL
  expected tokens: 0.5
  signature: 4SXM3Dmw1Nz49UDacibbHrTNcZndBhMH5LJX3FXUxYkMWmHJgbbxfQJMhMHeYxPEH7ZBRbywpwNvRpyTk1fc6sSU
(venv) shyskov@Shyskov:~/Solana/Lab3$ python dex.py state --mint 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg --cluster devnet
DEX state
  state: 4y9MbA6EGKz2fGW54CUsfPAgKukMNu2EK73MZAr16Tt1
  authority: 4HL2C5M2p2Xq9wPdWFBgpcLiBCQSCb4xiTCn82MmP5ZW
  token mint: 3BXHrq3PJpU3zNmEH6u8friMkuKWfag1pukHsPE2QsQg
  wsol mint: So11111111111111111111111111111111111111112
  token vault: 4UpwayTNDjbGG2W5MFueXY16F2MK96Kzenwgsji7UXhk
  wsol vault: D6KVW7e81oSgArUsdjyfME1ZVhaFqe9pAbv8nb2gNBKq
  rate: 1 token -> 0.5 SOL
  decimals: 2