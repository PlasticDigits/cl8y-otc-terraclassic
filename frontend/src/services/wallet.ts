/**
 * Terra Classic wallet integration using cosmes
 * Supports: Station, Keplr, LUNC Dash, Galaxy Station, Leap, Cosmostation
 */
import {
  ConnectedWallet,
  CosmostationController,
  GalaxyStationController,
  KeplrController,
  LeapController,
  LUNCDashController,
  StationController,
  WalletController,
  WalletName,
  WalletType,
} from '@goblinhunt/cosmes/wallet';
import { MsgExecuteContract } from '@goblinhunt/cosmes/client';
import { CosmosTxV1beta1Fee as Fee } from '@goblinhunt/cosmes/protobufs';
import type { UnsignedTx } from '@goblinhunt/cosmes/wallet';
import { NETWORKS, DEFAULT_NETWORK } from '../utils/constants';

const GAS_PRICE_ULUNA = '28.325';
const SWAP_GAS_LIMIT = 500000;

const networkConfig = NETWORKS[DEFAULT_NETWORK];
const TERRA_CLASSIC_CHAIN_ID = networkConfig.chainId;
const TERRA_RPC_URL = networkConfig.rpc;
const WC_PROJECT_ID = '2ce7811b869be33ffad28cff05c93c15'; // Public WalletConnect project ID

const GAS_PRICE = { amount: '28.325', denom: 'uluna' };

const STATION_CONTROLLER = new StationController();
const KEPLR_CONTROLLER = new KeplrController(WC_PROJECT_ID);
const LUNCDASH_CONTROLLER = new LUNCDashController();
const GALAXY_CONTROLLER = new GalaxyStationController(WC_PROJECT_ID);
const LEAP_CONTROLLER = new LeapController(WC_PROJECT_ID);
const COSMOSTATION_CONTROLLER = new CosmostationController(WC_PROJECT_ID);

const CONTROLLERS: Partial<Record<WalletName, WalletController>> = {
  [WalletName.STATION]: STATION_CONTROLLER,
  [WalletName.KEPLR]: KEPLR_CONTROLLER,
  [WalletName.LUNCDASH]: LUNCDASH_CONTROLLER,
  [WalletName.GALAXYSTATION]: GALAXY_CONTROLLER,
  [WalletName.LEAP]: LEAP_CONTROLLER,
  [WalletName.COSMOSTATION]: COSMOSTATION_CONTROLLER,
};

const connectedWallets: Map<string, ConnectedWallet> = new Map();

export { WalletName, WalletType };
export type TerraWalletType = 'station' | 'keplr' | 'luncdash' | 'galaxy' | 'leap' | 'cosmostation';

function getChainInfo() {
  return { chainId: TERRA_CLASSIC_CHAIN_ID, rpc: TERRA_RPC_URL, gasPrice: GAS_PRICE };
}

export function isStationInstalled(): boolean {
  return typeof window !== 'undefined' && 'station' in window;
}

export function isKeplrInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.keplr;
}

export function isLeapInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.leap;
}

export function isCosmostationInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.cosmostation;
}

async function suggestTerraClassicChain(walletName: WalletName): Promise<void> {
  const supportedWallets: Set<WalletName> = new Set([
    WalletName.STATION,
    WalletName.KEPLR,
    WalletName.LEAP,
    WalletName.COSMOSTATION,
  ]);
  if (!supportedWallets.has(walletName)) return;

  const config = NETWORKS[DEFAULT_NETWORK];
  const chainInfo = {
    chainId: config.chainId,
    chainName: config.name,
    rpc: config.rpc,
    rest: config.lcd,
    bip44: { coinType: 330 },
    bech32Config: {
      bech32PrefixAccAddr: 'terra',
      bech32PrefixAccPub: 'terrapub',
      bech32PrefixValAddr: 'terravaloper',
      bech32PrefixValPub: 'terravaloperpub',
      bech32PrefixConsAddr: 'terravalcons',
      bech32PrefixConsPub: 'terravalconspub',
    },
    currencies: [
      { coinDenom: 'LUNC', coinMinimalDenom: 'uluna', coinDecimals: 6 },
      { coinDenom: 'USTC', coinMinimalDenom: 'uusd', coinDecimals: 6 },
    ],
    feeCurrencies: [
      {
        coinDenom: 'LUNC',
        coinMinimalDenom: 'uluna',
        coinDecimals: 6,
        gasPriceStep: { low: 28.325, average: 28.325, high: 50 },
      },
    ],
    stakeCurrency: { coinDenom: 'LUNC', coinMinimalDenom: 'uluna', coinDecimals: 6 },
  };

  type WalletExt = { experimentalSuggestChain?: (info: unknown) => Promise<void> };
  type StationExt = { keplr?: WalletExt };

  let ext: WalletExt | undefined;
  if (walletName === WalletName.STATION) {
    ext = (window.station as StationExt | undefined)?.keplr as WalletExt | undefined;
  } else if (walletName === WalletName.KEPLR) {
    ext = window.keplr as WalletExt | undefined;
  } else if (walletName === WalletName.LEAP) {
    ext = window.leap as WalletExt | undefined;
  } else if (walletName === WalletName.COSMOSTATION) {
    ext = window.cosmostation?.providers?.keplr as WalletExt | undefined;
  }

  if (!ext?.experimentalSuggestChain) return;

  try {
    await ext.experimentalSuggestChain(chainInfo);
  } catch (err) {
    console.warn(`[Wallet] experimentalSuggestChain failed for ${walletName}:`, err);
  }
}

export async function connectTerraWallet(
  walletName: WalletName = WalletName.STATION,
  walletType: WalletType = WalletType.EXTENSION
): Promise<{ address: string; walletType: TerraWalletType; connectionType: WalletType }> {
  const controller = CONTROLLERS[walletName];
  if (!controller) throw new Error(`Unsupported wallet: ${walletName}`);

  try {
    const chainInfo = getChainInfo();

    if (walletType === WalletType.EXTENSION) {
      await suggestTerraClassicChain(walletName);
    }

    const wallets = await controller.connect(walletType, [chainInfo]);

    if (wallets.size === 0) {
      if (walletType === WalletType.WALLETCONNECT) {
        throw new Error(
          'WalletConnect connection failed. The wallet may be connected but unable to verify. ' +
          'Please try disconnecting and reconnecting.'
        );
      }
      throw new Error(
        `${walletName} could not connect to Terra Classic (${chainInfo.chainId}). ` +
        'The wallet may not support this chain. Try updating your wallet extension.'
      );
    }

    const wallet = wallets.get(TERRA_CLASSIC_CHAIN_ID);
    if (!wallet) {
      throw new Error(`Failed to connect to Terra Classic chain (${TERRA_CLASSIC_CHAIN_ID})`);
    }

    connectedWallets.set(TERRA_CLASSIC_CHAIN_ID, wallet);

    const walletTypeMap: Partial<Record<WalletName, TerraWalletType>> = {
      [WalletName.STATION]: 'station',
      [WalletName.KEPLR]: 'keplr',
      [WalletName.LUNCDASH]: 'luncdash',
      [WalletName.GALAXYSTATION]: 'galaxy',
      [WalletName.LEAP]: 'leap',
      [WalletName.COSMOSTATION]: 'cosmostation',
    };

    return {
      address: wallet.address,
      walletType: walletTypeMap[walletName] || 'station',
      connectionType: walletType,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (walletName === WalletName.KEPLR) {
      if (errorMessage.includes('not installed') || errorMessage.includes('Keplr')) {
        throw new Error('Keplr wallet is not installed. Please install the Keplr extension.');
      }
    }

    if (walletName === WalletName.STATION) {
      if (errorMessage.includes('not installed') || errorMessage.includes('Station')) {
        throw new Error('Station wallet is not installed. Please install the Station extension.');
      }
    }

    if (errorMessage.includes('User rejected') || errorMessage.includes('rejected')) {
      throw new Error('Connection rejected by user');
    }

    const displayNames: Partial<Record<WalletName, string>> = {
      [WalletName.STATION]: 'Station',
      [WalletName.KEPLR]: 'Keplr',
      [WalletName.LUNCDASH]: 'LUNC Dash',
      [WalletName.GALAXYSTATION]: 'Galaxy Station',
      [WalletName.LEAP]: 'Leap',
      [WalletName.COSMOSTATION]: 'Cosmostation',
    };

    throw new Error(`Failed to connect ${displayNames[walletName] || 'wallet'}: ${errorMessage}`);
  }
}

export async function disconnectTerraWallet(): Promise<void> {
  const wallet = connectedWallets.get(TERRA_CLASSIC_CHAIN_ID);
  if (wallet) {
    const controller = CONTROLLERS[wallet.id];
    controller?.disconnect([TERRA_CLASSIC_CHAIN_ID]);
    connectedWallets.delete(TERRA_CLASSIC_CHAIN_ID);
  }
}

export function getConnectedWallet(): ConnectedWallet | null {
  return connectedWallets.get(TERRA_CLASSIC_CHAIN_ID) || null;
}

function estimateFee(gasLimit: number): Fee {
  const feeAmount = Math.ceil(parseFloat(GAS_PRICE_ULUNA) * gasLimit);
  return new Fee({
    amount: [{ amount: feeAmount.toString(), denom: 'uluna' }],
    gasLimit: BigInt(gasLimit),
  });
}

export async function executeContractWithCoins(
  contractAddress: string,
  executeMsg: Record<string, unknown>,
  coins?: Array<{ denom: string; amount: string }>
): Promise<{ txHash: string }> {
  const wallet = getConnectedWallet();
  if (!wallet) throw new Error('Wallet not connected');

  const msg = new MsgExecuteContract({
    sender: wallet.address,
    contract: contractAddress,
    msg: executeMsg,
    funds: coins && coins.length > 0 ? coins : [],
  });

  const unsignedTx: UnsignedTx = { msgs: [msg], memo: '' };
  const fee = estimateFee(SWAP_GAS_LIMIT);
  const txHash = await wallet.broadcastTx(unsignedTx, fee);
  const { txResponse } = await wallet.pollTx(txHash);

  if (txResponse.code !== 0) {
    throw new Error(txResponse.rawLog || `Transaction failed with code ${txResponse.code}`);
  }

  return { txHash };
}

declare global {
  interface Window {
    station?: {
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      keplr?: {
        enable: (chainId: string) => Promise<void>;
        getOfflineSigner: (chainId: string) => unknown;
        experimentalSuggestChain?: (chainInfo: unknown) => Promise<void>;
      };
    };
    keplr?: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => unknown;
      experimentalSuggestChain?: (chainInfo: unknown) => Promise<void>;
    };
    leap?: {
      enable: (chainId: string) => Promise<void>;
      getOfflineSigner: (chainId: string) => unknown;
      experimentalSuggestChain?: (chainInfo: unknown) => Promise<void>;
    };
    cosmostation?: {
      providers: {
        keplr: unknown;
      };
    };
  }
}
