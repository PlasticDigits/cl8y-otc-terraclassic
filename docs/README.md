# CL8Y OTC Swap — Documentation

Monorepo for a trusted-owner OTC swap on Terra Classic.

## Architecture

```mermaid
flowchart LR
  depositor[Any address] -->|"CW20 Transfer CL8Y"| contract[OTC Swap Contract]
  user[User] -->|"Swap + native USDC"| contract
  contract -->|"CW20 Transfer CL8Y"| user
  contract -->|"BankMsg Send USDC"| dest[Destination]
  owner[Owner] -->|"UpdateRate / UpdateDestination"| contract
  frontend[Static Vite dApp] -.->|"LCD queries + wallet tx"| contract
```

## Folders

- **contracts/** — CosmWasm `cl8y-otc` contract
- **frontend/** — React + Vite static dApp
- **docs/** — This documentation

## Rate math

- `price` = micro-USDC per 1 whole CL8Y (18 decimals)
- Default: `700000` = 0.70 USDC per CL8Y
- `cl8y_out = floor(usdc_in_micro * 10^18 / price)`

See [contract.md](contract.md) and [frontend.md](frontend.md) for details.
