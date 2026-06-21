/**
 * Terra Classic wallet integration using cosmes
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
const WC_PROJECT_ID = '2ce7811b869be33ffad28cff05c93c15';

const GAS_PRICE = { amount: '28.325', denom: 'uluna' };

const CONTROLLERS: Partial<Record<WalletName, WalletController>> = {
  [WalletName.STATION]: new StationController(),
  [WalletName.KEPLR]: new KeplrController(WC_PROJECT_ID),
  [WalletName.LUNCDASH]: new LUNCDashController(),
  [WalletName.GALAXYSTATION]: new GalaxyStationController(WC_PROJECT_ID),
  [WalletName.LEAP]: new LeapController(WC_PROJECT_ID),
  [WalletName.COSMOSTATION]: new CosmostationController(WC_PROJECT_ID),
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

export async function connectTerraWallet(
  walletName: WalletName = WalletName.STATION,
  walletType: WalletType = WalletType.EXTENSION
): Promise<{ address: string; walletType: TerraWalletType; connectionType: WalletType }> {
  const controller = CONTROLLERS[walletName];
  if (!controller) throw new Error(`Unsupported wallet: ${walletName}`);

  const chainInfo = getChainInfo();
  const wallets = await controller.connect(walletType, [chainInfo]);
  const wallet = wallets.get(TERRA_CLASSIC_CHAIN_ID);
  if (!wallet) throw new Error(`Failed to connect to ${TERRA_CLASSIC_CHAIN_ID}`);

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
    station?: unknown;
    keplr?: unknown;
    leap?: unknown;
    cosmostation?: { providers: { keplr: unknown } };
  }
}
