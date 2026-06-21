# CL8Y OTC Deploy Scripts

## Build WASM

```bash
cd contracts
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source=cl8y_otc_cache,target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/optimizer:0.15.0
```

Output: `artifacts/cl8y_otc.wasm`

## Deploy

1. Edit `instantiate.json` with owner and destination addresses.
2. Run:

```bash
./deploy.sh mainnet <wallet_name>
```

## Generate schema

```bash
cd contracts/contracts/cl8y-otc
cargo run --features library --bin schema
```
