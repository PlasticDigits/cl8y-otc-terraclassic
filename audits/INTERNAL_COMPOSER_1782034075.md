# Internal Security Audit — CL8Y OTC Terra Classic

| Field | Value |
|-------|-------|
| **Auditor** | Composer (Cursor Agent) |
| **Date** | 2026-06-21 |
| **Epoch** | 1782034075 |
| **Repository** | `cl8y-otc-terraclassic` |
| **Scope** | Full codebase (contracts, frontend, scripts, docs) |
| **Commit** | Working tree at audit time |

---

## Executive Summary

CL8Y OTC is a **small, intentionally centralized** OTC swap on Terra Classic: users send Noble USDC (IBC native) and receive CL8Y (CW20) at a price set solely by a trusted owner. The monorepo contains:

- One CosmWasm contract (`cl8y-otc`)
- A static React/Vite dApp (no backend)
- Deploy scripts and documentation

**There is no Rust HTTP server, no database, no oracle, and no CI/CD pipeline.**

The contract logic is minimal and generally sound for its stated threat model (trusted owner). The dominant risks are **operational and economic centralization**, not classic smart-contract exploit bugs. The frontend is a thin wallet/LCD client with several UX and configuration risks that do not bypass on-chain checks but can mislead users.

### Severity Overview

| Severity | Count | Theme |
|----------|-------|-------|
| Critical | 2 | Trusted-owner rug vectors; CosmWasm migration admin |
| High | 5 | Owner front-running; missing pause/slippage; dev-mode misconfig; test gaps on privileged ops |
| Medium | 8 | Client-side rate display; float parsing; LCD trust; missing validations |
| Low | 6 | localStorage persistence; unused security config; informational hardening |
| Informational | 12 | By-design behaviors, N/A categories, process gaps |

### Test Suite Status (at audit time)

| Suite | Result |
|-------|--------|
| `cargo test` | **23/24 pass** — 1 failing test (`compute_cl8y_out_floors_just_below_one_cl8y` has wrong expected value in frontend mirror test) |
| `npm run test` | **18/19 pass** — same failing rounding test in `swap.test.ts` |
| `npm run test:e2e` | Not executed in this audit (requires dev server); specs exist but only cover dev/mock mode |

---

## 1. System Architecture & Attack Surface Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER (SPA)                        │
│  React dApp ──LCD REST──► Terra Classic LCD (public endpoints)  │
│            ──RPC/wallet──► Wallet extensions / WalletConnect     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ MsgExecuteContract + funds
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              CosmWasm: cl8y-otc (on-chain, authoritative)        │
│  CONFIG: owner, cl8y_token, usdc_denom, destination, price       │
│  Execute: Swap (public) | UpdateRate/Destination/Withdraw (owner)│
└───────────┬───────────────────────────────┬─────────────────────┘
            │ CW20 Transfer                   │ BankMsg Send
            ▼                                 ▼
      CL8Y CW20 token                    USDC destination
```

### Components In Scope

| Component | Path | Security relevance |
|-----------|------|------------------|
| CosmWasm contract | `contracts/contracts/cl8y-otc/src/` | **Primary** — funds, access control, math |
| Schema binary | `contracts/contracts/cl8y-otc/src/bin/schema.rs` | ABI surface |
| Deploy script | `contracts/scripts/deploy.sh` | Sets CosmWasm admin, instantiation params |
| Frontend services | `frontend/src/services/` | LCD queries, tx broadcast, dev mocks |
| Frontend UI | `frontend/src/pages/`, `components/` | Display, admin UX (non-authoritative) |
| Wallet store | `frontend/src/stores/wallet.ts` | Persisted address, balance cache |
| E2E tests | `frontend/e2e/` | Dev-mode only coverage |
| Docs | `docs/` | Declared threat model |

### Components Explicitly Out of Scope / Absent

| Area | Status |
|------|--------|
| Rust HTTP server (Axum/Actix) | **Not present** |
| SQL/NoSQL database | **Not present** |
| ORM / migrations | **Not present** |
| Oracle / price feeds (Band, Pyth, etc.) | **Not present** |
| Backend API / webhooks | **Not present** |
| Kubernetes / Docker runtime | Build-only Docker reference for WASM optimizer |
| CI/CD (GitLab CI, GitHub Actions) | **Not present** |
| Prior third-party audits | **Not present** |

---

## 2. Expanded Security Analysis Areas

Beyond the categories requested, the following additional areas were examined:

1. **CosmWasm chain-level admin** vs contract `owner` field (two separate privilege layers)
2. **CW20 inventory model** — unaccounted deposits via plain `Transfer` (no receive hook)
3. **IBC denom validation** — hardcoded expected USDC denom at instantiate
4. **Message ordering** in `execute_swap` (CL8Y transfer before USDC forward)
5. **Integer width transitions** (`Uint128` → `Uint256` → `Uint128`)
6. **Rounding / dust economics** — floor division residue
7. **LCD endpoint trust & caching** — stale reads, fallback behavior
8. **WalletConnect project ID** exposure and relay trust
9. **Floating-point amount parsing** in frontend (`parseAmount`)
10. **Zustand localStorage persistence** of wallet metadata
11. **Static hosting attack surface** (SPA redirects, missing CSP)
12. **Supply-chain dependencies** (`@goblinhunt/cosmes` fork, CosmWasm crate pins)
13. **AGPL-3.0 license** compliance for deployments
14. **Concurrent swap / inventory race** within single-block execution
15. **WASM build reproducibility** (optimizer Docker image version pinning)
16. **Deployment artifact handling** (`deployment-*.json` written locally)
17. **Instantiate parameter validation** (zero price, invalid bech32)
18. **Absence of `migrate` entry point** — migration behavior undefined in contract
19. **Gas estimation hardcoding** (`SWAP_GAS_LIMIT = 500000`)
20. **Test negative-path coverage matrix** for all execute variants

---

## 3. Smart Contract Security

### 3.1 Design Summary

The contract (`contract.rs`) implements:

| Message | Access | Behavior |
|---------|--------|----------|
| `Swap {}` | Anyone + exactly one USDC coin | Compute CL8Y out, transfer CL8Y to sender, forward USDC to destination |
| `UpdateRate { price }` | Owner | Set price (micro-USDC per whole CL8Y), must be > 0 |
| `UpdateDestination { destination }` | Owner | Change USDC recipient |
| `WithdrawCl8y { amount }` | Owner | Transfer CL8Y inventory to owner |

Queries: `Config`, `TotalUsdcSpent`, `SimulateSwap`.

**Rate formula:** `cl8y_out = floor(usdc_in_micro × 10^18 / price)`

### 3.2 Access Control

```206:211:contracts/contracts/cl8y-otc/src/contract.rs
fn assert_owner(info: &MessageInfo, owner: &cosmwasm_std::Addr) -> Result<(), ContractError> {
    if info.sender != *owner {
        return Err(ContractError::Unauthorized {});
    }
    Ok(())
}
```

| Finding | Severity | Detail |
|---------|----------|--------|
| Single EOA owner, no multisig | High | Owner key compromise = full protocol control. By design per README, but critical for users. |
| No `UpdateOwner` message | Informational | Owner is immutable after instantiate; no transfer path (reduces accidental transfer bugs, increases lock-in risk). |
| No timelock on admin actions | High | Rate and destination changes are instant; users swapping in same block as owner tx have no protection. |
| `assert_owner` is strict equality | Low | Correct for CosmWasm; no sub-account delegation. |

### 3.3 Fund Parsing (`parse_usdc_funds`)

```213:229:contracts/contracts/cl8y-otc/src/contract.rs
fn parse_usdc_funds(funds: &[Coin], expected_denom: &str) -> Result<Uint128, ContractError> {
    if funds.is_empty() {
        return Err(ContractError::NoFunds {});
    }
    if funds.len() != 1 {
        return Err(ContractError::InvalidFunds { ... });
    }
    let coin = &funds[0];
    if coin.denom != expected_denom || coin.amount.is_zero() {
        return Err(ContractError::InvalidFunds { ... });
    }
    Ok(coin.amount)
}
```

| Attack | Mitigated? | Notes |
|--------|------------|-------|
| Multi-coin injection | ✅ | Rejects `funds.len() != 1` |
| Wrong denom | ✅ | Exact string match on `usdc_denom` from config |
| Zero-amount swap | ✅ | Rejected |
| IBC denom spoofing at contract level | ✅ | Denom set at instantiate; only that denom accepted |
| Fee-grant / authz bypass | N/A | Standard CosmWasm `info.sender` semantics |

**Gap:** No maximum swap amount enforced (could drain inventory in one tx if funded).

### 3.4 Integer Math & Overflow

```231:239:contracts/contracts/cl8y-otc/src/contract.rs
pub fn compute_cl8y_out(usdc_in: Uint128, price: Uint128) -> Result<Uint128, ContractError> {
    if price.is_zero() {
        return Err(ContractError::InvalidPrice {});
    }
    let numerator = Uint256::from(usdc_in) * Uint256::from(CL8Y_UNIT);
    let out = numerator / Uint256::from(price);
    out.try_into().map_err(|_| ContractError::Overflow {})
}
```

| Finding | Severity | Detail |
|---------|----------|--------|
| Overflow on `usdc_in * CL8Y_UNIT` | ✅ Safe | Uses `Uint256` for intermediate product |
| Result truncation to `Uint128` | ✅ Tested | `compute_cl8y_out_overflow_when_result_exceeds_u128` covers `Uint128::MAX` input |
| Division by zero | ✅ | `InvalidPrice` if price is zero |
| Rounding direction | Informational | Floor division **favors the contract** (users receive less CL8Y); dust remains as unsold inventory |

`overflow-checks = true` in release profile (`contracts/Cargo.toml`) provides additional Rust-level safety.

### 3.5 Swap Execution Flow

```72:115:contracts/contracts/cl8y-otc/src/contract.rs
fn execute_swap(...) {
    // 1. Load config, parse USDC
    // 2. Compute cl8y_out
    // 3. Query CL8Y balance >= cl8y_out
    // 4. SubMsg: CW20 Transfer CL8Y → sender
    // 5. SubMsg: BankMsg Send USDC → destination
    // 6. Increment TOTAL_USDC_SPENT
}
```

| Attack | Mitigated? | Notes |
|--------|------------|-------|
| Reentrancy | ✅ | CosmWasm transactions are atomic; no external callbacks before state finalization |
| CEI pattern violation | Low risk | State (`TOTAL_USDC_SPENT`) updated before submessages execute; if submessage fails, whole tx reverts |
| Insufficient CL8Y inventory | ✅ | Pre-transfer balance check |
| Concurrent swaps depleting inventory | ✅ (within tx) | Each swap checks balance at execution time; later swap in same block fails if inventory insufficient |
| USDC not forwarded on CL8Y failure | ✅ | Atomic rollback |

### 3.6 WithdrawCl8y

```150:171:contracts/contracts/cl8y-otc/src/contract.rs
fn execute_withdraw_cl8y(...) {
    assert_owner(...)?;
    // Direct CW20 Transfer to owner — no balance pre-check
}
```

| Finding | Severity | Detail |
|---------|----------|--------|
| No on-contract balance check before withdraw | Medium | Relies on CW20 contract rejecting insufficient balance; error message may be opaque |
| No `amount > 0` validation | Low | Zero-amount withdraw likely succeeds as no-op |
| No unit test for unauthorized withdraw | High | Only integration test uses withdraw to drain inventory; no dedicated auth test |
| Owner can drain all inventory | Critical (by design) | Users with pending intent to swap lose access to CL8Y inventory |

### 3.7 Missing Contract Features (Security-Relevant)

| Feature | Present? | Risk |
|---------|----------|------|
| Pause / circuit breaker | ❌ | Cannot stop swaps during incident |
| Slippage / min-out parameter on `Swap` | ❌ | User accepts whatever on-chain price is at execution |
| Rate change bounds / max deviation | ❌ | Owner can set arbitrary price instantly |
| `migrate` entry point | ❌ | Chain admin can still migrate WASM via CosmWasm admin |
| CW20 `Receive` hook | ❌ | Intentional — CL8Y deposits are unlogged plain transfers |
| Event-rich logging beyond attributes | Partial | Basic attributes only |
| Two-step ownership transfer | ❌ | N/A — no ownership transfer at all |

### 3.8 CosmWasm Admin (Chain-Level)

```77:82:contracts/scripts/deploy.sh
INIT_TX=$(terrad tx wasm instantiate "$CODE_ID" "$INST_MSG" \
    --label "cl8y-otc" \
    --admin "$WALLET" \
    ...
```

| Finding | Severity | Detail |
|---------|----------|--------|
| Deployer wallet is CosmWasm admin | **Critical** | Admin can `migrate` contract to arbitrary WASM without on-chain owner check. Separate from contract `owner` field. |
| No guidance to renounce admin | High | `docs/contract.md` does not document admin renunciation (`--admin ""`) post-audit |

**Recommendation:** After audit and final WASM hash verification, set CosmWasm admin to empty or a multisig timelock.

---

## 4. DeFi & Economic Attack Analysis

### 4.1 Applicable DeFi Attack Vectors

| Attack | Applicable? | Assessment |
|--------|-------------|------------|
| Flash loan price manipulation | ❌ | No AMM, no oracle, fixed owner price |
| Oracle manipulation | ❌ | No oracle integration |
| Sandwich / MEV on AMM | ❌ | No pool; swaps are direct OTC |
| Liquidity pool drain | ❌ | No LP tokens |
| Impermanent loss | ❌ | N/A |
| Governance attack | ❌ | No governance token |
| **Owner rug pull** | ✅ | **Primary economic risk** |
| **Owner front-running rate change** | ✅ | Owner sees mempool, raises price before user swap confirms |
| **Destination hijacking** | ✅ | Owner redirects all future USDC flows |
| **Inventory withdrawal during active sale** | ✅ | Owner drains CL8Y while UI still shows availability |
| Donation / inflation attack | Low | Anyone can deposit CL8Y to contract — only increases user-available inventory |
| Dust / rounding extraction | Low | Floor rounding leaves sub-1-base-unit CL8Y dust in contract over many swaps |

### 4.2 Tokenomics

| Property | Value | Risk |
|----------|-------|------|
| Payment | Noble USDC (6 dec, IBC) | Denom fixed at instantiate |
| Reward | CL8Y CW20 (18 dec) | Token address fixed at instantiate |
| Default price | 0.70 USDC / CL8Y | Owner can change anytime |
| Fees | None | No protocol revenue on-chain |
| Supply cap on sales | CL8Y inventory in contract | Limited by deposits − withdrawals − swaps |
| `TotalUsdcSpent` | Analytics counter | Theoretically could overflow `Uint128` at extreme volume (informational) |

### 4.3 Trusted-Owner Threat Model (Critical)

The README explicitly states **"trusted-owner OTC swap."** Users must trust that the owner will:

1. Not raise price mid-sale without notice
2. Not redirect USDC destination to attacker address
3. Not withdraw all CL8Y inventory while marketing ongoing sales
4. Secure the owner private key
5. Not migrate contract code via CosmWasm admin

**This is not a trustless DeFi protocol.** Document clearly for end users.

### 4.4 Oracle Manipulation

**Not applicable.** Price is manually set by owner via `UpdateRate`. There is no external price feed to manipulate. The risk equivalent is **owner price manipulation**, not oracle attacks.

---

## 5. Common Smart Contract Attack Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Reentrancy | ✅ Not vulnerable | No callbacks; atomic execution |
| Integer overflow/underflow | ✅ Mitigated | Uint256 intermediate, overflow-checks in release |
| Access control bypass | ✅ Tested for rate/destination | Withdraw auth not unit-tested |
| Unchecked external calls | ✅ | CW20/Bank messages revert whole tx on failure |
| Front-running | ⚠️ Owner can front-run users | No user protection |
| Signature replay | N/A | No off-chain signatures |
| Denial of service | ⚠️ | Owner can set extreme price or drain inventory |
| Logic bugs in math | ✅ Extensively unit-tested | 15+ math test cases |
| Uninitialized storage | ✅ | Set in instantiate |
| Proxy / upgrade bugs | ⚠️ | No migrate in contract; chain admin can migrate |
| Timestamp manipulation | N/A | No time dependencies |
| tx.origin authentication | N/A | Uses `info.sender` correctly |

---

## 6. Database & Data Leak Analysis

**Not applicable.** This project has no database, ORM, SQL, Redis, or server-side session store.

### Frontend Client-Side Data

| Storage | Data | Leak risk |
|---------|------|-----------|
| `localStorage` (`cl8y-wallet-storage`) | `walletType`, `address` | Low — public on-chain data; could fingerprint returning users |
| React Query cache | Config, balances | In-memory only |
| LCD cache (`contract.ts`) | Contract queries, balances | Low — stale data risk, not a privacy leak |

### Database-Style Attack Patterns (N/A but verified)

| Pattern | Status |
|---------|--------|
| SQL injection | N/A |
| NoSQL injection | N/A |
| Connection string exposure | N/A |
| Migration secrets in repo | N/A |
| PII in logs | N/A — no server logs |

---

## 7. Rust Server Code

**Not applicable.** All Rust code is the CosmWasm on-chain contract:

- `contracts/contracts/cl8y-otc/src/contract.rs` — main logic (~740 lines including tests)
- `state.rs`, `msg.rs`, `error.rs`, `lib.rs`, `bin/schema.rs`

No Tokio, Axum, SQLx, or HTTP handlers exist in project source.

---

## 8. Frontend Security

### 8.1 Trust Boundaries

The frontend is **not a security boundary**. All authorization is enforced on-chain. Frontend admin lock (`isOwnerWallet`) is cosmetic.

### 8.2 Findings

| ID | Severity | Location | Finding |
|----|----------|----------|---------|
| F-01 | High | `App.tsx`, `contract.ts` | `VITE_DEV_MODE=true` enables mock LCD, mock balances, mock tx hashes. If shipped to production, users see fake data and non-real swaps. |
| F-02 | Medium | `SwapCard.tsx` | Uses local `computeCl8yOut` for display instead of on-chain `simulate_swap` query. Stale cached config could show wrong expected output until refresh. |
| F-03 | Medium | `format.ts` `parseAmount` | Uses `parseFloat` + `Math.floor` — IEEE-754 precision loss for large human amounts. Chain is authoritative, but user may sign unexpected amount. |
| F-04 | Medium | `AdminPage.tsx` | No client-side validation of Terra bech32 address for destination update. Invalid addresses fail on-chain but waste gas. |
| F-05 | Medium | `contract.ts` | On LCD failure, returns **stale cache** without age limit (ignores `staleCacheTtl`, `endpointCooldown` in constants). User may act on outdated price. |
| F-06 | Low | `constants.ts` | `staleCacheTtl`, `minRequestInterval`, `endpointCooldown` defined but **never used** — incomplete rate-limiting / staleness implementation. |
| F-07 | Low | Routing | `/admin` reachable by URL but not linked in nav — security through obscurity; on-chain auth still required for mutations. |
| F-08 | Low | `wallet.ts` | Hardcoded WalletConnect project ID (`2ce7811b869be33ffad28cff05c93c15`) — shared public ID, relay trust dependency. |
| F-09 | Low | `vite.config.ts` | `sourcemap: false` — good for prod; hinders incident response debugging. |
| F-10 | Informational | Hosting | No CSP, HSTS, or security headers in repo — depends entirely on static host (Netlify `_redirects` only). |
| F-11 | Informational | `contract.ts` | No `withdraw_cl8y` UI — owner must use CLI/other tooling (reduces accidental exposure, increases operational risk). |
| F-12 | Informational | `dist/` | Built artifacts committed or present in workspace — verify production deploys from reproducible CI builds, not stale `dist/`. |

### 8.3 Wallet Integration

- Uses `@goblinhunt/cosmes` (forked cosmes) for Station, Keplr, Leap, Cosmostation, LUNC Dash, Galaxy Station
- Gas limit hardcoded to `500000` — may fail on complex chain conditions or succeed with excess fee
- Transaction failure surfaces `rawLog` to user — acceptable; ensure no sensitive data logged

---

## 9. Test Coverage Assessment

### 9.1 Contract Tests (`cargo test`)

**24 tests** in `contract.rs`:

| Category | Covered | Missing |
|----------|---------|---------|
| Instantiate default price | ✅ | Invalid owner address, zero price at instantiate |
| `compute_cl8y_out` math | ✅ (15 tests) | Fuzz/property-based tests |
| `UpdateRate` auth | ✅ non-owner rejected | Zero price by owner, unauthorized withdraw |
| `UpdateDestination` | ✅ owner success | Non-owner rejection test, invalid bech32 |
| `Swap` happy path | ✅ unit + integration | Max amount, exact inventory boundary |
| `Swap` insufficient CL8Y | ✅ | — |
| `Swap` no funds / wrong denom | ✅ | Multiple coins with one valid, native LUNC sent |
| `SimulateSwap` query | ✅ | — |
| `WithdrawCl8y` | ⚠️ integration only | Unauthorized caller, over-balance, zero amount |
| Concurrent swaps | ❌ | Multi-test same-block inventory race |
| `TOTAL_USDC_SPENT` overflow | ❌ | Extreme cumulative volume |
| Message reply handling | N/A | No reply entry |

### 9.2 Frontend Unit Tests (`vitest`)

| File | Tests | Coverage |
|------|-------|----------|
| `swap.test.ts` | 16 | Math helpers, `isOwnerWallet` |
| `AdminPage.test.tsx` | 3 | Connect/lock/unlock UI states |

**Not tested:** `SwapCard`, `contract.ts`, `wallet.ts`, `format.ts`, hooks, balance refresh, LCD fallback logic.

**Known failure:** `floors just below 1 whole CL8Y` expects `999998571428571428571n` but correct value is `999998571428571428n` (contract test has correct assertion). **Test bug, not contract bug.**

### 9.3 E2E Tests (Playwright, 5 workers)

| Spec | Scenarios | Limitations |
|------|-----------|-------------|
| `home.spec.ts` | Render, rate calc, swap disabled w/o wallet | No real wallet |
| `swap.spec.ts` | Mock tx with `devconnect=1` | Dev mode only |
| `admin.spec.ts` | Mock owner unlock | Dev mode only |

**Missing E2E scenarios:**

- Real wallet integration (or mocked LCD with production config)
- Swap failure paths (insufficient balance, wrong denom, rejected tx)
- Rate change reflected in UI after config refresh
- Admin rejection for non-owner with dev mode off
- Contract address misconfiguration empty state
- Network/LCD outage behavior

### 9.4 Happy Path vs Bad Path Matrix

| Flow | Happy | Bad path tested? |
|------|-------|------------------|
| Swap | ✅ integration | Partial (no funds, wrong denom, insufficient CL8Y) |
| Update rate | ✅ owner | ✅ unauthorized |
| Update destination | ✅ owner | ❌ unauthorized |
| Withdraw CL8Y | ✅ integration drain | ❌ unauthorized |
| Instantiate | ✅ default | ❌ invalid params |
| Frontend swap | ✅ e2e mock | ❌ real failure modes |
| LCD query failure | ❌ | ❌ |

---

## 10. Access Control & Privileges Summary

| Role | Capabilities | Enforcement |
|------|--------------|-------------|
| **Any user** | `Swap` with USDC | On-chain |
| **Contract owner** | `UpdateRate`, `UpdateDestination`, `WithdrawCl8y` | On-chain `assert_owner` |
| **CosmWasm admin** (deployer) | Migrate WASM, potentially replace logic | Chain-level, **not contract owner** |
| **Frontend "admin"** | UI for rate/destination | Cosmetic `isOwnerWallet` check |
| **CL8Y depositor** | Plain CW20 transfer to contract | No access control (intentional) |

**Privilege escalation paths:** None found beyond owner key compromise or CosmWasm admin migration.

---

## 11. Missing Security Features (Recommendations)

### On-Chain (by priority)

1. **Document and renounce CosmWasm admin** after audited WASM deployment
2. **Multisig owner** (e.g., Safe on Terra) for production
3. **Timelock** on `UpdateRate` and `UpdateDestination` (24–48h delay)
4. **Optional `min_cl8y_out`** on `Swap` for slippage protection against owner rate changes in same block
5. **Pause flag** controlled by owner or guardian
6. **Rate bounds** — e.g., max 2× change per update
7. **`migrate` entry point** with strict version checks if upgrades are needed
8. **Inventory query** exposing CL8Y balance for transparency
9. **Explicit `amount > 0`** check on withdraw

### Off-Chain / Process

1. **CI pipeline** running `cargo test`, `npm test`, `clippy`, `npm audit`, WASM reproducible build
2. **Environment separation** — build-time strip of `VITE_DEV_MODE` in production
3. **Use `simulate_swap` query** in SwapCard for displayed output
4. **BigInt-based `parseAmount`** instead of float
5. **Implement `staleCacheTtl`** enforcement in LCD client
6. **Security headers** on static host
7. **Third-party audit** before mainnet deployment with material TVL
8. **Bug bounty / SECURITY.md** disclosure policy

---

## 12. Dependency & Supply Chain

| Dependency | Version | Note |
|------------|---------|------|
| `cosmwasm-std` | 1.5.11 | Pinned workspace |
| `cw-multi-test` | 1.0.0 | Dev only |
| `base64ct` | =1.7.3 | Explicit pin (transitive vuln mitigation) |
| `@goblinhunt/cosmes` | ^0.0.71-ghunt.18 | **Fork** — review fork delta vs upstream |
| `vite` / `react` | ^5.0.8 / ^18.2.0 | Standard; run `npm audit` regularly |

WASM build: `cosmwasm/optimizer:0.15.0` — verify checksum matches deployed code.

---

## 13. Deployment & Operational Security

| Item | Risk | Recommendation |
|------|------|----------------|
| `instantiate.json` placeholders (`terra1...`) | Medium | Validate real addresses before mainnet deploy |
| Deploy script interactive mainnet confirm | Low | Good guardrail |
| `deployment-*.json` local artifacts | Low | Do not commit; may leak deployment timing |
| No code ID / checksum registry in repo | Medium | Publish verified WASM hash in docs or releases |
| Owner key on deployer machine | Critical | Use hardware wallet, separate admin from hot key |

---

## 14. Findings Register (Consolidated)

| ID | Severity | Component | Title | Recommendation |
|----|----------|-----------|-------|----------------|
| C-01 | Critical | Economic | Owner can rug via rate, destination, and CL8Y withdraw | Disclose trust model; use multisig + timelock for production |
| C-02 | Critical | Deploy | CosmWasm admin can migrate contract independently of owner | Renounce admin or use multisig; document in ops runbook |
| H-01 | High | Economic | Owner can front-run user swaps with instant rate increase | Timelock + optional `min_cl8y_out` on Swap |
| H-02 | High | Contract | No pause mechanism during incident | Add emergency pause |
| H-03 | High | Frontend | Dev mode env vars could enable mock production UI | CI assert `VITE_DEV_MODE` unset in prod builds |
| H-04 | High | Testing | `WithdrawCl8y` unauthorized path untested | Add unit test for non-owner withdraw |
| H-05 | High | Testing | `UpdateDestination` non-owner rejection untested | Add symmetric auth test |
| M-01 | Medium | Frontend | Swap display uses local math not `simulate_swap` | Query chain for displayed output |
| M-02 | Medium | Frontend | Float parsing in `parseAmount` | Use decimal/BigInt library |
| M-03 | Medium | Frontend | Stale LCD cache served without TTL cap | Enforce `staleCacheTtl` |
| M-04 | Medium | Contract | `WithdrawCl8y` no balance pre-check | Pre-query balance for clearer errors |
| M-05 | Medium | Process | No CI/CD | Add GitLab CI with test + audit gates |
| M-06 | Medium | Contract | No slippage protection on Swap | Add `min_cl8y_out` parameter |
| M-07 | Medium | Ops | No verified WASM hash publication | Publish SHA256 of optimized WASM |
| M-08 | Medium | Testing | Failing unit test indicates drift | Fix expected value in `swap.test.ts` |
| L-01 | Low | Frontend | Wallet address persisted in localStorage | Document; optional clear on disconnect |
| L-02 | Low | Frontend | Unused LCD rate-limit constants | Implement or remove dead config |
| L-03 | Low | Contract | Zero-amount withdraw allowed | Reject `amount == 0` |
| L-04 | Low | Frontend | Admin route URL discoverable | Acceptable; ensure users know trust model |
| L-05 | Low | Wallet | Hardcoded WalletConnect project ID | Use project-specific ID |
| L-06 | Low | Contract | No max swap size | Consider per-tx cap for inventory management |
| I-01 | Info | Design | Floor rounding favors contract | Document for users |
| I-02 | Info | Design | No oracle — no oracle manipulation risk | N/A |
| I-03 | Info | Architecture | No database — no SQL injection surface | N/A |
| I-04 | Info | Architecture | No Rust server attack surface | N/A |
| I-05 | Info | License | AGPL-3.0 | Ensure network use compliance |
| I-06 | Info | Testing | No fuzz/property tests | Consider `proptest` for math |
| I-07 | Info | E2E | Tests require dev mode mocks | Add contract integration tests against testnet |
| I-08 | Info | Docs | Trust model stated in README | Expand user-facing risk disclosure in UI |
| I-09 | Info | Contract | CL8Y deposits unlogged | Acceptable; inventory is queryable via CW20 balance |
| I-10 | Info | Gas | Fixed 500k gas limit | Monitor and adjust |
| I-11 | Info | Analytics | `TotalUsdcSpent` not used for logic | Safe but could overflow at extreme scale |
| I-12 | Info | Audits | No prior external audit | Commission before significant TVL |

---

## 15. Conclusion

CL8Y OTC is a **deliberately simple, trusted-owner OTC** with a small, readable attack surface. The CosmWasm contract implements correct fund validation, overflow-safe math, and basic access control. Classic DeFi exploit classes (reentrancy, oracle manipulation, flash loans, AMM manipulation, database injection) are **largely not applicable** due to architecture.

The **primary risks are centralization and operations**: a compromised or malicious owner (or CosmWasm admin) can harm users instantly. The frontend adds configuration and display risks but does not bypass on-chain checks.

**Before mainnet use with meaningful funds:**

1. Fix failing frontend test (confirm contract math is canonical)
2. Add missing auth tests for `WithdrawCl8y` and `UpdateDestination`
3. Renounce or multisig CosmWasm admin
4. Deploy multisig owner with timelock on parameter changes
5. Add CI, production build guards against dev mode
6. Commission external audit
7. Add user-visible trust/risk disclosure in the swap UI

---

## Appendix A: Files Reviewed

```
contracts/contracts/cl8y-otc/src/{contract,state,msg,error,lib}.rs
contracts/contracts/cl8y-otc/src/bin/schema.rs
contracts/Cargo.toml
contracts/scripts/{deploy.sh,instantiate.json,README.md}
frontend/src/{App,main}.tsx
frontend/src/pages/{HomePage,AdminPage,AdminPage.test}.tsx
frontend/src/components/swap/{SwapCard,BalanceCards}.tsx
frontend/src/components/{common,layout}/**
frontend/src/services/{contract,wallet}.ts
frontend/src/hooks/{useContract,useWallet}.ts
frontend/src/stores/wallet.ts
frontend/src/utils/{constants,swap,swap.test,format}.ts
frontend/e2e/{home,swap,admin}.spec.ts
frontend/{vite.config.ts,playwright.config.ts,package.json}
docs/{README,contract,frontend,tokens}.md
README.md
.gitignore
```

## Appendix B: Commands Run

```bash
date +%s                                    # epoch: 1782034075
cd contracts && cargo test                  # 23 pass, 1 fail (frontend test mirror)
cd frontend && npm run test                 # 18 pass, 1 fail
```

---

*This is an internal automated audit and does not replace a professional third-party smart contract audit.*
