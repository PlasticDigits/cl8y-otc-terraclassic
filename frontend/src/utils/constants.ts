/**
 * Constants for CL8Y OTC Frontend
 */

export const NETWORKS = {
  testnet: {
    chainId: 'rebel-2',
    name: 'TerraClassic Testnet',
    rpc: 'https://rpc.luncblaze.com',
    lcd: 'https://lcd.luncblaze.com',
    lcdFallbacks: [
      'https://lcd.luncblaze.com',
      'https://lcd.terra-classic.hexxagon.dev',
    ],
    scanner: 'https://finder.terraclassic.community/rebel-2',
  },
  mainnet: {
    chainId: 'columbus-5',
    name: 'TerraClassic Mainnet',
    rpc: 'https://terra-classic-rpc.publicnode.com',
    lcd: 'https://terra-classic-lcd.publicnode.com',
    lcdFallbacks: [
      'https://terra-classic-lcd.publicnode.com',
      'https://api-lunc-lcd.binodes.com',
      'https://lcd.terra-classic.hexxagon.io',
    ],
    scanner: 'https://finder.terraclassic.community/columbus-5',
  },
} as const;

export const LCD_CONFIG = {
  minRequestInterval: 500,
  cacheTtl: 10000,
  staleCacheTtl: 60000,
  requestTimeout: 8000,
  endpointCooldown: 30000,
} as const;

export const DEFAULT_NETWORK = 'mainnet' as keyof typeof NETWORKS;

/** CL8Y bridged USDT (Tether USD) CW20. 18 decimals. */
export const USDT_TOKEN =
  'terra1z0xe7t5ymmltg4vju8tghkq0pewy4et548ta23nlu9zxtl950uyqkv8mv4';

export const TOKENS = {
  usdt: {
    symbol: 'USDT',
    decimals: 18,
    address: import.meta.env.VITE_USDT_TOKEN || USDT_TOKEN,
  },
  cl8y: {
    symbol: 'CL8Y',
    decimals: 18,
    address:
      import.meta.env.VITE_CL8Y_TOKEN ||
      'terra16wtml2q66g82fdkx66tap0qjkahqwp4lwq3ngtygacg5q0kzycgqvhpax3',
  },
} as const;

/** Vyntrex market page for CL8Y on Terra Classic */
export const VYNTREX_MARKET_URLS = {
  cl8y:
    'https://vyntrex.io/market/columbus-5/terra1kkrwna59jzpvsp7n4l3xdt72rmejcz5d2xaezxl29zvkssn7vvtqmtmemv',
} as const;

/** Mainnet OTC. This address stays after the USDT migration; the code id changes. */
export const MAINNET_OTC_CONTRACT =
  'terra1e6cuvl55gyfn4yqavcar39v9g4y75mt6dvpw4c6u68rkvz9jkrmq59xedp';

export const CONTRACTS = {
  testnet: {
    otc: import.meta.env.VITE_OTC_CONTRACT_TESTNET || '',
  },
  mainnet: {
    otc:
      import.meta.env.VITE_OTC_CONTRACT ||
      import.meta.env.VITE_OTC_CONTRACT_MAINNET ||
      (import.meta.env.VITE_DEV_MODE === 'true' ? '' : MAINNET_OTC_CONTRACT),
  },
} as const;

/** USDT base units per 1 whole CL8Y. Default 0.70 USDT (18 decimals). */
export const DEFAULT_PRICE = '700000000000000000';

/** 10^18 — one whole CL8Y or USDT in base units. */
export const CL8Y_UNIT = 1_000_000_000_000_000_000n;

export const POLLING_INTERVAL = 10000;

export const DOC_LINKS = {
  architecture: '/docs/README.md',
  contract: '/docs/contract.md',
  tokens: '/docs/tokens.md',
} as const;
