# CL8Y OTC Swap — Documentation

Monorepo for a trusted-owner OTC swap on Terra Classic.

Standing product diagram and merge/CI rules:
[architecture.md](architecture.md). Catch-all CODEOWNERS removal:
[ADR 0001](adr/0001-remove-catchall-codeowners.md)
([#3](https://git.cl8y.com/code/cl8y-otc-terraclassic/issues/3)).

## Specs

- [Contract](contract.md) — instantiate, execute, query, rate math
- [Frontend](frontend.md) — Vite dApp, env, pages, tests
- [Tokens](tokens.md) — CL8Y CW20, Noble USDC denom, default price

## Folders

- **contracts/** — CosmWasm `cl8y-otc` contract
- **frontend/** — React + Vite static dApp
- **docs/** — This documentation
