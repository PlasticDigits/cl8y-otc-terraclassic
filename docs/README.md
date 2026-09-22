# CL8Y OTC Swap — Documentation

Monorepo for a trusted-owner OTC swap on Terra Classic.

## Architecture

```mermaid
flowchart LR
  depositor[Any address] -->|"CW20 Transfer CL8Y"| contract[OTC Swap Contract]
  user[User] -->|"CW20 Send USDT + swap hook"| contract
  contract -->|"CW20 Transfer CL8Y"| user
  contract -->|"CW20 Transfer USDT"| dest[Destination]
  owner[Owner] -->|"UpdateRate / UpdateDestination"| contract
  frontend[Static Vite dApp] -.->|"LCD queries + wallet tx"| contract
```

## Folders

- **contracts/** — CosmWasm `cl8y-otc` contract
- **frontend/** — React + Vite static dApp
- **docs/** — This documentation

## Rate math

- `price` = USDT base units (18 decimals) per 1 whole CL8Y
- Default: `700000000000000000` = 0.70 USDT per CL8Y
- `cl8y_out = floor(usdt_in * 10^18 / price)`

See [contract.md](contract.md) and [frontend.md](frontend.md) for details.
