#!/bin/bash
# CL8Y OTC Contract Deployment Script for Terra Classic
#
# Usage: ./deploy.sh <network> [code_id]
#   network: testnet | mainnet
#   code_id: optional — skip store and instantiate this code_id (recovery after a successful store)
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

log_info() { echo -e "${GREEN}[INFO]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Poll until the tx is indexed (public RPCs can lag right after broadcast).
wait_for_tx() {
    local txhash="$1"
    local max_attempts="${2:-30}"
    local sleep_secs="${3:-2}"
    local attempt=1
    local tx_json=""

    while [ "$attempt" -le "$max_attempts" ]; do
        if tx_json=$(terrad query tx "$txhash" --node "$RPC" --output json 2>/dev/null); then
            if echo "$tx_json" | jq -e '.code == 0 or .code == "0"' >/dev/null 2>&1; then
                echo "$tx_json"
                return 0
            fi
            log_error "Tx $txhash failed on chain"
            echo "$tx_json" | jq -r '.raw_log // .log // empty' >&2
            return 1
        fi
        log_info "Waiting for tx $txhash (attempt $attempt/$max_attempts)..."
        sleep "$sleep_secs"
        attempt=$((attempt + 1))
    done

    log_error "Tx $txhash not found after $max_attempts attempts"
    return 1
}

# Support both legacy (.logs[].events) and current (.events) terrad output.
get_event_attr() {
    local tx_json="$1"
    local event_type="$2"
    local attr_key="$3"
    echo "$tx_json" | jq -r --arg t "$event_type" --arg k "$attr_key" '
        def all_events: (.events // []) + ([.logs[]?.events // []] | add // []);
        all_events[] | select(.type == $t) | .attributes[] | select(.key == $k) | .value'
}

usage() {
    echo "Usage: $0 <network> [code_id]"
    echo "  network: testnet | mainnet"
    echo "  code_id: optional — skip store, instantiate existing code"
    exit 1
}

[ $# -ge 1 ] || usage

NETWORK="$1"
EXISTING_CODE_ID="${2:-}"

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
if [ -n "$EXISTING_CODE_ID" ]; then
    CODE_ID="$EXISTING_CODE_ID"
    log_info "Skipping store; using existing code ID: $CODE_ID"
elif [ ! -f "$WASM" ]; then
    log_error "WASM not found: $WASM"
    log_info "Build with: docker run --rm -v \"\$(pwd)\":/code cosmwasm/optimizer:0.17.0"
    exit 1
else
    log_info "Storing contract (deployer: $DEPLOYER_KEY)..."
    STORE_TX=$(terrad tx wasm store "$WASM" --from "$DEPLOYER_KEY" $TERRAD_FLAGS --output json)
    STORE_HASH=$(echo "$STORE_TX" | jq -r '.txhash')
    log_info "Store tx hash: $STORE_HASH"
    STORE_RESULT=$(wait_for_tx "$STORE_HASH")
    CODE_ID=$(get_event_attr "$STORE_RESULT" "store_code" "code_id")
    if [ -z "$CODE_ID" ]; then
        log_error "Could not read code_id from store tx $STORE_HASH"
        exit 1
    fi
    log_info "Code ID: $CODE_ID"
fi

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
log_info "Instantiate tx hash: $INIT_HASH"
INIT_RESULT=$(wait_for_tx "$INIT_HASH")
CONTRACT=$(get_event_attr "$INIT_RESULT" "instantiate" "_contract_address")
if [ -z "$CONTRACT" ]; then
    log_error "Could not read contract address from instantiate tx $INIT_HASH"
    exit 1
fi

log_info "Contract deployed: $CONTRACT"
echo "{\"network\":\"$NETWORK\",\"code_id\":\"$CODE_ID\",\"contract\":\"$CONTRACT\"}" > "${SCRIPT_DIR}/deployment-${NETWORK}-$(date +%Y%m%d%H%M%S).json"
