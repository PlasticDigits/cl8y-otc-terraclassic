# Pause-only guardian source, v0.3.0

This describes source behavior and migration compatibility for v0.3.0.
Deployment is outside this change; source support does not make an existing
v0.2.0 instance pausable. Confirm deployed code and Wasm admin before an upgrade.

## Authority and compatibility

Existing `Config`, token/treasury addresses, price units, accounting keys and
recovery functions retain their layout and behavior. The independent
`cl8y_otc_pause_v1` item stores `{paused: bool, guardian: Option<Addr>}`. Missing
old storage queries unpaused/no guardian without writes; new instances use the
same default. An upgrade never silently installs a privileged guardian.

| Message | Authority | Behavior |
| --- | --- | --- |
| `{"pause":{}}` | Config owner or current guardian | Idempotently blocks new swaps |
| `{"unpause":{}}` | Config owner only | Explicit recovery, never automatic |
| `{"set_pause_guardian":{"guardian": ADDRESS}}` | Config owner only | Validated guardian distinct from owner and this contract |
| `{"set_pause_guardian":{"guardian":null}}` | Config owner only | Revokes without clearing a pause |
| Query `{"pause_status":{}}` | Public/read-only | Returns `paused` and optional `guardian` |

New controls reject attached native funds. Guardians cannot change config,
withdraw, migrate or unpause. Rotation immediately revokes the old guardian's
pause authority. The owner can still pause without a guardian, configure the
contract, use existing owner-only CW20 recovery while paused, and unpause after
review. The chain's Wasm migration admin is separate; it is not implicitly an
application owner or pauser.

Authenticated USDT CW20 Receive hooks check the pause before hook parsing,
queries, transfer messages and accounting; the internal swap executor also
checks it. A paused CW20 Send fails the whole transaction, rolling back the
CW20 debit and OTC effects together. There is no separate refund transaction.
Quotes and existing config response shape remain unchanged; a quote while
paused is not authorization to trade.

Blind CW20 Transfer and native bank sends act outside this receiver and cannot
be intercepted by its flag. Existing owner-only CW20 recovery remains available;
this adds no native withdrawal or other asset-moving authority. The OTC has no
queued-user-exit system to freeze or modify.

## Narrow migration

Version becomes `0.3.0`; exact cw2 contract identity `cl8y-otc` is required.

- **v0.2.0 → v0.3.0:** `{"pause_upgrade":{}}` reads current USDT config/accounting,
  adds only default pause state and updates cw2 metadata. It does not rewrite
  config bytes, prices, addresses, totals or unrelated storage. Existing pause
  state is refused rather than overwritten.
- **v0.1.0 → v0.3.0:** the historical `{"usdt_token": ADDRESS, "price": OPTIONAL}`
  shape retains the specialized Noble-USDC-only conversion checks, price scaling
  and accounting transition; it also initializes default pause state. It cannot
  be used against v0.2.0 as a generic upgrade.

Wrong contract name, unsupported/future versions, mixed message shapes and
repeated current-version migration fail. Failed validation leaves direct unit
storage unchanged. Rust callers now use explicit migration enum variants; old
on-chain legacy JSON remains accepted only for its original source version.

Live Wasm admin must exist to migrate. An admin-cleared instance requires a new
deployment and separately reviewed inventory/liquidity/frontend migration.
This migration does not replace application ownership. Do not bypass version
checks or downgrade to code that ignores the pause item to obtain a rollback.

## Local proof and release gates

The `pause17` tests cover limited roles, rotation/revocation, old-state defaults,
all intake/internal swap gates, unchanged recovery/quotes, exact storage
preservation, invalid migration identity/version/shape and actual CW20 atomic
rollback via cw-multi-test. Specialized migration regressions run separately.
Each invocation is bounded to 55 seconds, with offline locked dependencies:

```text
cargo test --manifest-path contracts/Cargo.toml -p cl8y-otc --lib pause17 --offline --locked
cargo test --manifest-path contracts/Cargo.toml -p cl8y-otc --lib migrate_ --offline --locked
cargo fmt --manifest-path contracts/Cargo.toml --all -- --check
```

Before deployment, independently review the source and record the exact live
chain/address, code checksum/cw2 version, Wasm admin, config owner, token
addresses/decimals, destination, price and accounting. Confirm distinct guardian
identity and actual roles. Rehearse the upgrade in isolation and bind simulation,
finality and post-state/paused-send rollback/recovery evidence to that deployment.
Do not infer deployment or permission from source tests alone.
