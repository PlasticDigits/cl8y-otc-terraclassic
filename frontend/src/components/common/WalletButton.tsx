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
    isLeapAvailable,
    isCosmostationAvailable,
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

  const handleConnect = async (walletName: WalletName, walletType: WalletType = WalletType.EXTENSION) => {
    setError(null);
    try {
      await connect(walletName, walletType);
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
            <div className="relative z-10 w-full max-w-sm glass border border-amber-500/20 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">Connect Wallet</h3>
                <button onClick={closeModal} className="p-1 text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-3">
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    <span>{error}</span>
                  </div>
                )}

                <p className="text-xs text-amber-500/70 uppercase tracking-wider font-medium">Browser Extension</p>

                <WalletOption
                  name="Terra Station"
                  icon={<StationIcon />}
                  description={isStationAvailable ? 'Recommended' : 'Not installed'}
                  available={isStationAvailable}
                  loading={connectingWallet === WalletName.STATION}
                  onClick={() => handleConnect(WalletName.STATION, WalletType.EXTENSION)}
                  disabled={connecting}
                />
                <WalletOption
                  name="Keplr"
                  icon={<KeplrIcon />}
                  description={isKeplrAvailable ? 'Keplr, Trust Wallet & compatible' : 'Not installed'}
                  available={isKeplrAvailable}
                  loading={connectingWallet === WalletName.KEPLR}
                  onClick={() => handleConnect(WalletName.KEPLR, WalletType.EXTENSION)}
                  disabled={connecting}
                />
                <WalletOption
                  name="Leap"
                  icon={<LeapIcon />}
                  description={isLeapAvailable ? 'Multi-chain' : 'Not installed'}
                  available={isLeapAvailable}
                  loading={connectingWallet === WalletName.LEAP}
                  onClick={() => handleConnect(WalletName.LEAP, WalletType.EXTENSION)}
                  disabled={connecting}
                />
                <WalletOption
                  name="Cosmostation"
                  icon={<CosmostationIcon />}
                  description={isCosmostationAvailable ? 'Cosmos wallet' : 'Not installed'}
                  available={isCosmostationAvailable}
                  loading={connectingWallet === WalletName.COSMOSTATION}
                  onClick={() => handleConnect(WalletName.COSMOSTATION, WalletType.EXTENSION)}
                  disabled={connecting}
                />

                <p className="text-xs text-amber-500/70 uppercase tracking-wider mt-4 font-medium">Mobile / WalletConnect</p>

                <WalletOption
                  name="LUNC Dash"
                  icon={<LuncDashIcon />}
                  description="Mobile wallet"
                  available
                  loading={connectingWallet === WalletName.LUNCDASH}
                  onClick={() => handleConnect(WalletName.LUNCDASH, WalletType.WALLETCONNECT)}
                  disabled={connecting}
                />
                <WalletOption
                  name="Galaxy Station"
                  icon={<GalaxyIcon />}
                  description="Mobile wallet"
                  available
                  loading={connectingWallet === WalletName.GALAXYSTATION}
                  onClick={() => handleConnect(WalletName.GALAXYSTATION, WalletType.WALLETCONNECT)}
                  disabled={connecting}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

interface WalletOptionProps {
  name: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
  loading?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function WalletOption({ name, icon, description, available, loading, onClick, disabled }: WalletOptionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !available}
      className={`
        w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200
        ${available && !disabled
          ? 'border-white/5 hover:border-amber-500/40 hover:bg-amber-500/5 cursor-pointer group'
          : 'border-white/5 opacity-40 cursor-not-allowed'
        }
      `}
    >
      {icon}
      <div className="flex-1 text-left">
        <p className="font-medium text-white group-hover:text-amber-50 transition-colors">{name}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {loading ? (
        <svg className="w-5 h-5 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : available && !disabled ? (
        <svg className="w-5 h-5 text-gray-600 group-hover:text-amber-500/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      ) : null}
    </button>
  );
}

function StationIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
      <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    </div>
  );
}

function KeplrIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
      <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    </div>
  );
}

function LeapIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
  );
}

function CosmostationIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
      <svg className="w-6 h-6 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </div>
  );
}

function LuncDashIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
      <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
      </svg>
    </div>
  );
}

function GalaxyIcon() {
  return (
    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
      <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    </div>
  );
}
