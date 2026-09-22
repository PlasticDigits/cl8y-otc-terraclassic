#!/bin/bash
# Migrate the existing mainnet CL8Y OTC contract in place (same address).
#
# Usage: ./migrate.sh [code_id]
#   code_id: optional — skip store and migrate to this code id
#
# Keys (same keyring passphrase as `terrad keys list`):
#   cl8ydeploy  — terra1hu4zggf3f8yw6jw3rxrjxn2drwad675gq5k2lv — store wasm
#   cl8y2_admin — terra1xsecn4snv94ezcez0z3vq8an9j4h4kxxcydp8l — migrate admin
#
# Omitting "price" in migrate.json scales the live micro-USDC price by 10^12.
# Current mainnet price 711700 becomes 711700000000000000 (0.7117 USDT per CL8Y).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARTIFACTS_DIR="${SCRIPT_DIR}/../artifacts"
MIGRATE_JSON="${SCRIPT_DIR}/migrate.json"

RPC="https://terra-classic-rpc.publicnode.com:443"
LCD="https://terra-classic-lcd.publicnode.com"
CHAIN_ID="columbus-5"
GAS_PRICES="28.325uluna"
GAS_ADJUSTMENT="1.4"

# terra1hu4zggf3f8yw6jw3rxrjxn2drwad675gq5k2lv
DEPLOYER_KEY="cl8ydeploy"
# terra1xsecn4snv94ezcez0z3vq8an9j4h4kxxcydp8l
ADMIN_KEY="cl8y2_admin"
ADMIN_ADDRESS="terra1xsecn4snv94ezcez0z3vq8an9j4h4kxxcydp8l"
CONTRACT="terra1e6cuvl55gyfn4yqavcar39v9g4y75mt6dvpw4c6u68rkvz9jkrmq59xedp"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

usage() {
    echo "Usage: $0 [code_id]"
    echo "  code_id: optional — skip store, migrate the existing contract to this code"
    exit 1
}

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

get_event_attr() {
    local tx_json="$1"
    local event_type="$2"
    local attr_key="$3"
    echo "$tx_json" | jq -r --arg t "$event_type" --arg k "$attr_key" '
        def all_events: (.events // []) + ([.logs[]?.events // []] | add // []);
        all_events[] | select(.type == $t) | .attributes[] | select(.key == $k) | .value'
}

[ $# -le 1 ] || usage
EXISTING_CODE_ID="${1:-}"

command -v terrad >/dev/null || { log_error "terrad not found"; exit 1; }
command -v jq >/dev/null || { log_error "jq not found"; exit 1; }
[ -f "$MIGRATE_JSON" ] || { log_error "Missing $MIGRATE_JSON"; exit 1; }

MIGRATE_MSG=$(jq -c . "$MIGRATE_JSON")
if ! echo "$MIGRATE_MSG" | jq -e '.usdt_token | length > 0' >/dev/null; then
    log_error "migrate.json must contain usdt_token"
    exit 1
fi
if echo "$MIGRATE_MSG" | jq -e 'has("price")' >/dev/null; then
    log_warn "migrate.json sets price explicitly; the live 711700 rate will NOT be scaled"
fi

log_info "Contract: $CONTRACT"
CONTRACT_INFO=$(curl -fsS -A "cl8y-otc-migrate" "$LCD/cosmwasm/wasm/v1/contract/$CONTRACT")
ONCHAIN_ADMIN=$(echo "$CONTRACT_INFO" | jq -r '.contract_info.admin')
ONCHAIN_CODE=$(echo "$CONTRACT_INFO" | jq -r '.contract_info.code_id')
if [ "$ONCHAIN_ADMIN" != "$ADMIN_ADDRESS" ]; then
    log_error "On-chain admin is $ONCHAIN_ADMIN, expected $ADMIN_ADDRESS ($ADMIN_KEY)"
    exit 1
fi
log_info "On-chain code id: $ONCHAIN_CODE"
log_info "On-chain admin: $ONCHAIN_ADMIN ($ADMIN_KEY)"

CURRENT=$(terrad query wasm contract-state smart "$CONTRACT" '{"config":{}}' --node "$RPC" --output json)
if echo "$CURRENT" | jq -e '.data.usdt_token' >/dev/null; then
    log_error "Contract config already has usdt_token. Refusing to migrate again."
    echo "$CURRENT" | jq '.data' >&2
    exit 1
fi
CURRENT_PRICE=$(echo "$CURRENT" | jq -r '.data.price')
CURRENT_DENOM=$(echo "$CURRENT" | jq -r '.data.usdc_denom')
log_info "Current price: $CURRENT_PRICE (micro-USDC per CL8Y)"
log_info "Current denom: $CURRENT_DENOM"
log_info "Migrate message: $MIGRATE_MSG"

log_warn "Migrating MAINNET ($CHAIN_ID). Address stays $CONTRACT."
read -r -p "Type yes to store (if needed) and migrate: " confirm
[ "$confirm" = "yes" ] || { log_info "Cancelled"; exit 0; }

TERRAD_FLAGS="--node $RPC --chain-id $CHAIN_ID --gas-prices $GAS_PRICES --gas-adjustment $GAS_ADJUSTMENT --gas auto -y"

WASM="${ARTIFACTS_DIR}/cl8y_otc.wasm"
if [ -n "$EXISTING_CODE_ID" ]; then
    CODE_ID="$EXISTING_CODE_ID"
    log_info "Skipping store; using existing code ID: $CODE_ID"
elif [ ! -f "$WASM" ]; then
    log_error "WASM not found: $WASM"
    log_info "Build from the repo root: docker run --rm -v \"\$(pwd)/contracts\":/code --mount type=volume,source=cl8y_otc_cache,target=/code/target --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry cosmwasm/optimizer:0.17.0"
    exit 1
else
    log_info "Storing wasm with key $DEPLOYER_KEY (keyring passphrase)..."
    STORE_TX=$(terrad tx wasm store "$WASM" --from "$DEPLOYER_KEY" $TERRAD_FLAGS --output json)
    STORE_HASH=$(echo "$STORE_TX" | jq -r '.txhash')
    log_info "Store tx hash: $STORE_HASH"
    STORE_RESULT=$(wait_for_tx "$STORE_HASH")
    CODE_ID=$(get_event_attr "$STORE_RESULT" "store_code" "code_id" | head -n 1)
    if [ -z "$CODE_ID" ]; then
        log_error "Could not read code_id from store tx $STORE_HASH"
        exit 1
    fi
    log_info "New code ID: $CODE_ID"
fi

log_info "Migrating with key $ADMIN_KEY (keyring passphrase)..."
MIGRATE_TX=$(terrad tx wasm migrate "$CONTRACT" "$CODE_ID" "$MIGRATE_MSG" \
    --from "$ADMIN_KEY" \
    $TERRAD_FLAGS \
    --output json)
MIGRATE_HASH=$(echo "$MIGRATE_TX" | jq -r '.txhash')
log_info "Migrate tx hash: $MIGRATE_HASH"
MIGRATE_RESULT=$(wait_for_tx "$MIGRATE_HASH")

UPDATED=$(terrad query wasm contract-state smart "$CONTRACT" '{"config":{}}' --node "$RPC" --output json)
echo "$UPDATED" | jq '.data' >&2
UPDATED_USDT=$(echo "$UPDATED" | jq -r '.data.usdt_token')
EXPECTED_USDT=$(echo "$MIGRATE_MSG" | jq -r '.usdt_token')
if [ "$UPDATED_USDT" != "$EXPECTED_USDT" ]; then
    log_error "Config usdt_token is $UPDATED_USDT, expected $EXPECTED_USDT"
    exit 1
fi

log_info "Migrated $CONTRACT to code $CODE_ID"
log_info "Prior USDC micro total: $(get_event_attr "$MIGRATE_RESULT" "wasm" "prior_usdc_micro" | head -n 1)"
echo "{\"network\":\"mainnet\",\"code_id\":\"$CODE_ID\",\"contract\":\"$CONTRACT\",\"migrate_tx\":\"$MIGRATE_HASH\"}" \
    > "${SCRIPT_DIR}/migration-mainnet-$(date +%Y%m%d%H%M%S).json"
