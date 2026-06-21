import { useCallback, useEffect, useState } from 'react';
import { useWalletStore, checkWalletAvailability, WalletName, WalletType } from '../stores/wallet';
import { contractService } from '../services/contract';
import { TOKENS, USDC_DENOM } from '../utils/constants';

export { WalletName, WalletType };

export function useWallet() {
  const store = useWalletStore();
  const [walletAvailability, setWalletAvailability] = useState(checkWalletAvailability);

  useEffect(() => {
    const check = () => setWalletAvailability(checkWalletAvailability());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!store.address) return;
    try {
      const [usdc, cl8y] = await Promise.all([
        contractService.getNativeBalance(store.address, USDC_DENOM),
        contractService.getCw20Balance(TOKENS.cl8y.address, store.address),
      ]);
      store.setBalances({ usdc, cl8y });
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  }, [store.address, store.setBalances]);

  const connect = useCallback(
    async (walletName: WalletName = WalletName.STATION, walletType: WalletType = WalletType.EXTENSION) => {
      await store.connect(walletName, walletType);
      await refreshBalances();
    },
    [store.connect, refreshBalances]
  );

  useEffect(() => {
    if (store.connected && store.address) {
      refreshBalances();
      const interval = setInterval(refreshBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [store.connected, store.address, refreshBalances]);

  return {
    ...store,
    connect,
    disconnect: store.disconnect,
    refreshBalances,
    isStationAvailable: walletAvailability.station,
    isKeplrAvailable: walletAvailability.keplr,
    isLeapAvailable: walletAvailability.leap,
    isCosmostationAvailable: walletAvailability.cosmostation,
  };
}
