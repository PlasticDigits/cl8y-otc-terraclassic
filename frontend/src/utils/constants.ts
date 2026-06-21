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

/** Noble USDC on Terra Classic via IBC channel-149 */
export const USDC_DENOM =
  'ibc/0BB9D8513E8E8E9AE6A9D211D9136E6DA42288DDE6CFAA453A150A4566054DC5';

export const TOKENS = {
  usdc: {
    symbol: 'USDC',
    decimals: 6,
    denom: USDC_DENOM,
  },
  cl8y: {
    symbol: 'CL8Y',
    decimals: 18,
    address:
      import.meta.env.VITE_CL8Y_TOKEN ||
      'terra16wtml2q66g82fdkx66tap0qjkahqwp4lwq3ngtygacg5q0kzycgqvhpax3',
  },
} as const;

/** Vyntrex market pages on Terra Classic */
export const VYNTREX_MARKET_URLS = {
  usdc:
    'https://vyntrex.io/market/columbus-5/terra1vnt3tjg0v98hgp0vx8nynvklnjqzkzsqvtpzv9v56r800gdhmxwstv5y64',
  cl8y:
    'https://vyntrex.io/market/columbus-5/terra1kkrwna59jzpvsp7n4l3xdt72rmejcz5d2xaezxl29zvkssn7vvtqmtmemv',
} as const;

/** Mainnet OTC contract (code ID 11448) */
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
      MAINNET_OTC_CONTRACT,
  },
} as const;

/** Micro-USDC per 1 whole CL8Y. Default 0.70 USDC */
export const DEFAULT_PRICE = '700000';

export const CL8Y_UNIT = 1_000_000_000_000_000_000n;

export const POLLING_INTERVAL = 10000;

export const DOC_LINKS = {
  architecture: '/docs/README.md',
  contract: '/docs/contract.md',
  tokens: '/docs/tokens.md',
} as const;
