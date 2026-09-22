# Contract Specification

## `cl8y-otc`

Minimal OTC swap: users send CL8Y bridged USDT (CW20, 18 decimals) and receive CL8Y CW20.

Payment is a CW20 `Send` into the OTC contract. The USDT token transfers the tokens, then calls `receive` with hook `{"swap":{}}`. The contract sends CL8Y to the payer and forwards the USDT to `destination`.

### Instantiate

```json
{
  "owner": "terra1...",
  "cl8y_token": "terra16wtml2q66g82fdkx66tap0qjkahqwp4lwq3ngtygacg5q0kzycgqvhpax3",
  "usdt_token": "terra1z0xe7t5ymmltg4vju8tghkq0pewy4et548ta23nlu9zxtl950uyqkv8mv4",
  "destination": "terra1...",
  "price": "700000000000000000"
}
```

`price` is optional; defaults to `700000000000000000` (0.70 USDT per CL8Y). Both tokens use 18 decimals, so that value is `0.70 × 10^18`.

### Migrate

The mainnet contract `terra1e6cuvl55gyfn4yqavcar39v9g4y75mt6dvpw4c6u68rkvz9jkrmq59xedp` stays at that address. On 2026-09-22 the admin migrated code `11448` (v0.1.0) to code `11675` (v0.2.0).

```json
{
  "usdt_token": "terra1z0xe7t5ymmltg4vju8tghkq0pewy4et548ta23nlu9zxtl950uyqkv8mv4"
}
```

Omit `price` to keep the current rate. The stored Noble price is micro-USDC (6 decimals) and is multiplied by `10^12`. The live price `711700` becomes `711700000000000000` (0.7117 USDT per CL8Y). Owner, CL8Y token, and destination are unchanged. `total_usdt_spent` starts at zero; the old USDC total is recorded on the migrate transaction as `prior_usdc_micro`.

### Execute

| Message | Caller | Description |
|---------|--------|-------------|
| USDT `send { contract, amount, msg }` | Anyone | `msg` is base64 `{"swap":{}}`. Swaps USDT for CL8Y |
| `receive` | USDT token only | Hook invoked by that `send` |
| `update_rate { price }` | Owner | Set new price (USDT base units per CL8Y) |
| `update_destination { destination }` | Owner | Set USDT forward address |
| `withdraw_cl8y { amount }` | Owner | Withdraw unsold CL8Y |
| `withdraw_usdt { amount }` | Owner | Withdraw USDT sent without the swap hook |

Example payer message, executed on the USDT CW20:

```json
{
  "send": {
    "contract": "terra1...otc",
    "amount": "700000000000000000",
    "msg": "eyJzd2FwIjp7fX0="
  }
}
```

`eyJzd2FwIjp7fX0=` is the base64 encoding of `{"swap":{}}`.

### Query

| Message | Returns |
|---------|---------|
| `config {}` | Owner, tokens, destination, price |
| `total_usdt_spent {}` | Cumulative USDT received from swaps |
| `simulate_swap { usdt_in }` | Expected CL8Y output |

### CL8Y inventory

Anyone can deposit CL8Y by sending a plain CW20 `Transfer` to the contract address. No receive hook required.

A plain `Transfer` of USDT does not swap. Those tokens stay in the contract until the owner withdraws them.

### Rate

`cl8y_out = floor(usdt_in × 10^18 / price)`

### Build & deploy

```bash
cd contracts
cargo test
# WASM: see contracts/scripts/README.md
./scripts/deploy.sh mainnet
```
