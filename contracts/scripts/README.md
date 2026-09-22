# CL8Y OTC Deploy Scripts

## Build WASM

The optimizer reads `/code/Cargo.toml`. That file is `contracts/Cargo.toml`, so mount `contracts/`, not the repo root.

```bash
# from the repo root
docker run --rm -v "$(pwd)/contracts":/code \
  --mount type=volume,source=cl8y_otc_cache,target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/optimizer:0.17.0
```

Output: `artifacts/cl8y_otc.wasm`

## Deploy

1. Edit `instantiate.json` with owner and destination addresses.
2. Run:

```bash
./deploy.sh mainnet
```

## Migrate mainnet in place

`migrate.sh` stores the wasm with `cl8ydeploy`, then migrates `terra1e6cuvl55gyfn4yqavcar39v9g4y75mt6dvpw4c6u68rkvz9jkrmq59xedp` with `cl8y2_admin`. The address does not change. `migrate.json` has no `price`, so the live `711700` micro-USDC rate is scaled to 18 decimals.

```bash
cd contracts/scripts
./migrate.sh
# if store already succeeded:
./migrate.sh <code_id>
```

The keyring asks for its passphrase once per transaction.

## Generate schema

```bash
cd contracts/contracts/cl8y-otc
cargo run --features library --bin schema
```
