import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useWallet, WalletName, WalletType } from '../../hooks/useWallet';
import { formatAddress, formatAmount } from '../../utils/format';

export function WalletButton() {
  const {
    connected,
    connecting,
    connectingWallet,
    address,
    usdcBalance,
    cl8yBalance,
    isStationAvailable,
    isKeplrAvailable,
    showWalletModal,
    connect,
    disconnect,
    cancelConnection,
    setShowWalletModal,
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setShowWalletModal(false);
    setError(null);
    if (connecting) cancelConnection();
  }, [connecting, cancelConnection, setShowWalletModal]);

  useEffect(() => {
    if (!showWalletModal) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showWalletModal, closeModal]);

  const handleConnect = async (walletName: WalletName) => {
    setError(null);
    try {
      await connect(walletName, WalletType.EXTENSION);
      setShowWalletModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  if (connected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 glass border border-white/10 hover:border-amber-500/30 rounded-xl transition-all"
        >
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500">{formatAddress(address, 6)}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600" />
        </button>
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 mt-2 w-52 glass border border-white/10 rounded-xl shadow-xl z-50 p-2">
              <p className="px-3 py-1 text-xs text-gray-500">{formatAddress(address, 10)}</p>
              <p className="px-3 py-1 text-sm font-mono-numbers">{formatAmount(usdcBalance, 6)} USDC</p>
              <p className="px-3 py-1 text-sm font-mono-numbers">{formatAmount(cl8yBalance, 18)} CL8Y</p>
              <button
                onClick={() => { disconnect(); setShowDropdown(false); }}
                className="w-full mt-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5 rounded-lg"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowWalletModal(true)}
        disabled={connecting}
        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-60"
      >
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showWalletModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={closeModal} />
            <div className="relative z-10 w-full max-w-sm glass border border-amber-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Connect Wallet</h3>
              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <div className="space-y-2">
                <WalletOption
                  name="Terra Station"
                  available={isStationAvailable}
                  loading={connectingWallet === WalletName.STATION}
                  onClick={() => handleConnect(WalletName.STATION)}
                />
                <WalletOption
                  name="Keplr"
                  available={isKeplrAvailable}
                  loading={connectingWallet === WalletName.KEPLR}
                  onClick={() => handleConnect(WalletName.KEPLR)}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function WalletOption({
  name,
  available,
  loading,
  onClick,
}: {
  name: string;
  available: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!available || loading}
      className="w-full p-4 rounded-xl border border-white/5 hover:border-amber-500/40 text-left disabled:opacity-40"
    >
      <p className="font-medium text-white">{name}</p>
      <p className="text-xs text-gray-500">{available ? 'Extension' : 'Not installed'}</p>
      {loading && <span className="text-xs text-amber-400">Connecting...</span>}
    </button>
  );
}
