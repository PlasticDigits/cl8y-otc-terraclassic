/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_MODE: string;
  readonly VITE_OTC_CONTRACT: string;
  readonly VITE_OTC_CONTRACT_MAINNET: string;
  readonly VITE_OTC_CONTRACT_TESTNET: string;
  readonly VITE_CL8Y_TOKEN: string;
  readonly VITE_MOCK_OWNER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Buffer: typeof import('buffer').Buffer;
}
