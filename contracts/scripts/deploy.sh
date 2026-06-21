#!/bin/bash
# CL8Y OTC Contract Deployment Script for Terra Classic
#
# Usage: ./deploy.sh <network>
#   network: testnet | mainnet
#
# Keys (terrad keyring, passphrase-protected):
#   cl8ydeploy  — deployer (store + instantiate txs)
#   cl8y2_admin — contract owner & migrate admin

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTIFACTS_DIR="${SCRIPT_DIR}/../artifacts"
INSTANTIATE_JSON="${SCRIPT_DIR}/instantiate.json"

TESTNET_RPC="https://terra-classic-testnet-rpc.publicnode.com:443"
TESTNET_CHAIN_ID="rebel-2"
MAINNET_RPC="https://terra-classic-rpc.publicnode.com:443"
MAINNET_CHAIN_ID="columbus-5"

GAS_PRICES="28.325uluna"
GAS_ADJUSTMENT="1.4"

# terra1hu4zggf3f8yw6jw3rxrjxn2drwad675gq5k2lv
DEPLOYER_KEY="cl8ydeploy"
# terra1xsecn4snv94ezcez0z3vq8an9j4h4kxxcydp8l
ADMIN_ADDRESS="terra1xsecn4snv94ezcez0z3vq8an9j4h4kxxcydp8l"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    echo "Usage: $0 <network>"
    echo "  network: testnet | mainnet"
    exit 1
}

[ $# -ge 1 ] || usage

NETWORK="$1"

case "$NETWORK" in
    testnet)
        RPC="$TESTNET_RPC"
        CHAIN_ID="$TESTNET_CHAIN_ID"
        log_info "Deploying to TESTNET ($CHAIN_ID)"
        ;;
    mainnet)
        RPC="$MAINNET_RPC"
        CHAIN_ID="$MAINNET_CHAIN_ID"
        log_warn "Deploying to MAINNET ($CHAIN_ID)"
        read -p "Deploy to mainnet? (yes/no): " confirm
        [ "$confirm" = "yes" ] || { log_info "Cancelled"; exit 0; }
        ;;
    *) log_error "Invalid network: $NETWORK"; usage ;;
esac

TERRAD_FLAGS="--node $RPC --chain-id $CHAIN_ID --gas-prices $GAS_PRICES --gas-adjustment $GAS_ADJUSTMENT --gas auto -y"

WASM="${ARTIFACTS_DIR}/cl8y_otc.wasm"
if [ ! -f "$WASM" ]; then
    log_error "WASM not found: $WASM"
    log_info "Build with: docker run --rm -v \"\$(pwd)\":/code cosmwasm/optimizer:0.15.0"
    exit 1
fi

log_info "Storing contract (deployer: $DEPLOYER_KEY)..."
STORE_TX=$(terrad tx wasm store "$WASM" --from "$DEPLOYER_KEY" $TERRAD_FLAGS --output json)
STORE_HASH=$(echo "$STORE_TX" | jq -r '.txhash')
terrad query tx "$STORE_HASH" --node "$RPC" --output json | jq -r '.logs[0].events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value' > /tmp/code_id.txt
CODE_ID=$(cat /tmp/code_id.txt)
log_info "Code ID: $CODE_ID"

INST_MSG=$(jq -c ".${NETWORK}.instantiate | .owner = \"$ADMIN_ADDRESS\"" "$INSTANTIATE_JSON")
log_info "Instantiating with: $INST_MSG"
log_info "Admin/owner: $ADMIN_ADDRESS (cl8y2_admin)"

INIT_TX=$(terrad tx wasm instantiate "$CODE_ID" "$INST_MSG" \
    --label "cl8y-otc" \
    --admin "$ADMIN_ADDRESS" \
    --from "$DEPLOYER_KEY" \
    $TERRAD_FLAGS \
    --output json)
INIT_HASH=$(echo "$INIT_TX" | jq -r '.txhash')
sleep 6
CONTRACT=$(terrad query tx "$INIT_HASH" --node "$RPC" --output json | \
    jq -r '.logs[0].events[] | select(.type=="instantiate") | .attributes[] | select(.key=="_contract_address") | .value')

log_info "Contract deployed: $CONTRACT"
echo "{\"network\":\"$NETWORK\",\"code_id\":\"$CODE_ID\",\"contract\":\"$CONTRACT\"}" > "${SCRIPT_DIR}/deployment-${NETWORK}-$(date +%Y%m%d%H%M%S).json"
