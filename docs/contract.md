# Contract Specification

## `cl8y-otc`

Minimal OTC swap: users send Noble USDC (native IBC) and receive CL8Y CW20.

### Instantiate

```json
{
  "owner": "terra1...",
  "cl8y_token": "terra16wtml2q66g82fdkx66tap0qjkahqwp4lwq3ngtygacg5q0kzycgqvhpax3",
  "usdc_denom": "ibc/0BB9D8513E8E8E9AE6A9D211D9136E6DA42288DDE6CFAA453A150A4566054DC5",
  "destination": "terra1...",
  "price": "700000"
}
```

`price` is optional; defaults to `700000` (0.70 USDC per CL8Y).

### Execute

| Message | Caller | Funds | Description |
|---------|--------|-------|-------------|
| `swap {}` | Anyone | USDC only | Swap USDC for CL8Y at current rate |
| `update_rate { price }` | Owner | None | Set new price (micro-USDC per CL8Y) |
| `update_destination { destination }` | Owner | None | Set USDC forward address |
| `withdraw_cl8y { amount }` | Owner | None | Withdraw unsold CL8Y |

### Query

| Message | Returns |
|---------|---------|
| `config {}` | Owner, tokens, destination, price |
| `total_usdc_spent {}` | Cumulative USDC received from swaps |
| `simulate_swap { usdc_in }` | Expected CL8Y output |

### CL8Y inventory

Anyone can deposit CL8Y by sending a plain CW20 `Transfer` to the contract address. No receive hook required.

### Build & deploy

```bash
cd contracts
cargo test
# WASM: see contracts/scripts/README.md
./scripts/deploy.sh mainnet <wallet>
```
