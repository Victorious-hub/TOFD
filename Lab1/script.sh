#!/bin/bash

URL="http://127.0.0.1:8899"

for arg in "$@"
do
  case $arg in
    url=dev)
      URL="https://api.devnet.solana.com"
      shift
      ;;
    url=test)
      URL="http://127.0.0.1:8899"
      shift
      ;;
    *)
      ;;
  esac
done

echo "Setting Solana URL to: $URL"
make set-url url=$URL

echo "Creating waller for URL: $URL"
make create-wallet file=cli-walltet_final.json 

SOLANA_ADDRESS=$(make solana-address | tail -n 1 | tr -d '[:space:]')

if [ -z "$SOLANA_ADDRESS" ]; then
  echo "Failed to get Solana address. Check your Makefile target 'solana-address'."
  exit 1
fi

echo "Requesting airdrop for account: $SOLANA_ADDRESS for URL: $URL"
make solana-airdrop amount=5

make solana-transfer

make solana-account-balance file=cli-walltet.json

echo "Our balance"

make solana-balance