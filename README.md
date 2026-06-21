# CL8Y OTC Swap (Terra Classic)

Trusted-owner OTC swap on Terra Classic: users pay Noble USDC (IBC) and receive CL8Y CW20 at an owner-set price.

## Structure

| Folder | Description |
|--------|-------------|
| [`contracts/`](contracts/) | CosmWasm `cl8y-otc` contract + deploy scripts |
| [`frontend/`](frontend/) | Static Vite React dApp |
| [`docs/`](docs/) | Architecture, contract spec, token reference |

## Quick start

```bash
# Contracts
cd contracts && cargo test

# Frontend
cd frontend && npm install && npm run dev
```

See [`docs/README.md`](docs/README.md) for full documentation.

## Deployed contracts

| Network | Chain ID | Code ID | OTC contract |
|---------|----------|---------|--------------|
| Mainnet | `columbus-5` | `11448` | [`terra1e6cuvl55gyfn4yqavcar39v9g4y75mt6dvpw4c6u68rkvz9jkrmq59xedp`](https://finder.terraclassic.community/columbus-5/address/terra1e6cuvl55gyfn4yqavcar39v9g4y75mt6dvpw4c6u68rkvz9jkrmq59xedp) |
| Testnet | `rebel-2` | — | Not deployed |
