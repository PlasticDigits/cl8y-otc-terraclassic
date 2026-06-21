# Frontend

Static Vite + React SPA for CL8Y OTC swap.

## Setup

```bash
cd frontend
npm install
npm run dev
```

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_OTC_CONTRACT` | Deployed OTC contract address (mainnet) |
| `VITE_CL8Y_TOKEN` | CL8Y CW20 address (default: mainnet CL8Y) |
| `VITE_DEV_MODE` | `true` — mock LCD/wallet for local UX testing |
| `VITE_MOCK_OWNER` | Owner address for dev admin unlock |

## Pages

- `/` — Swap UI (connect, balances, rate, USDC → CL8Y)
- `/admin` — Owner-only (not linked); update price & destination

## Design

Cyberminimalist Glass System — dark glass morphism, amber accents, minimal surface area. Secondary info linked in footer.

## Tests

```bash
npm run test        # Vitest unit tests
npm run test:e2e    # Playwright (5 workers)
npm run test:all
```

## Build

```bash
npm run build
```

Output: `frontend/dist/` — deploy to any static host (Netlify, Cloudflare Pages, etc.).
