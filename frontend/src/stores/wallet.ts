import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  connectTerraWallet,
  disconnectTerraWallet,
  isStationInstalled,
  isKeplrInstalled,
  isLeapInstalled,
  isCosmostationInstalled,
  WalletName,
  WalletType,
  TerraWalletType,
} from '../services/wallet';

export { WalletName, WalletType };
export type { TerraWalletType };

export interface WalletState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  walletType: TerraWalletType | null;
  connectionType: WalletType | null;
  chainId: string | null;
  usdcBalance: string;
  cl8yBalance: string;
  connectingWallet: WalletName | null;
  showWalletModal: boolean;
  connect: (walletName: WalletName, walletType?: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  setBalances: (balances: { usdc?: string; cl8y?: string }) => void;
  cancelConnection: () => void;
  setShowWalletModal: (show: boolean) => void;
}

export function checkWalletAvailability() {
  return {
    station: isStationInstalled(),
    keplr: isKeplrInstalled(),
    leap: isLeapInstalled(),
    cosmostation: isCosmostationInstalled(),
    luncdash: true,
    galaxy: true,
  };
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      connected: false,
      connecting: false,
      address: null,
      walletType: null,
      connectionType: null,
      chainId: null,
      usdcBalance: '0',
      cl8yBalance: '0',
      connectingWallet: null,
      showWalletModal: false,

      connect: async (walletName, walletTypeParam = WalletType.EXTENSION) => {
        set({ connecting: true, connectingWallet: walletName });
        try {
          const effectiveType =
            walletName === WalletName.LUNCDASH || walletName === WalletName.GALAXYSTATION
              ? WalletType.WALLETCONNECT
              : walletTypeParam;
          const result = await connectTerraWallet(walletName, effectiveType);
          set({
            connected: true,
            connecting: false,
            connectingWallet: null,
            address: result.address,
            walletType: result.walletType,
            connectionType: result.connectionType,
            chainId: 'columbus-5',
          });
        } catch (error) {
          set({ connecting: false, connectingWallet: null });
          throw error;
        }
      },

      disconnect: async () => {
        try {
          await disconnectTerraWallet();
        } catch {
          /* non-fatal */
        }
        set({
          connected: false,
          connecting: false,
          connectingWallet: null,
          address: null,
          walletType: null,
          connectionType: null,
          chainId: null,
          usdcBalance: '0',
          cl8yBalance: '0',
        });
      },

      setBalances: (balances) => {
        set((state) => ({
          usdcBalance: balances.usdc ?? state.usdcBalance,
          cl8yBalance: balances.cl8y ?? state.cl8yBalance,
        }));
      },

      cancelConnection: () => set({ connecting: false, connectingWallet: null }),
      setShowWalletModal: (show) => set({ showWalletModal: show }),
    }),
    {
      name: 'cl8y-wallet-storage',
      partialize: (state) => ({
        walletType: state.walletType,
        address: state.address,
      }),
    }
  )
);
