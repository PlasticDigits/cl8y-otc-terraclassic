import { WalletButton } from '../common';

export function Header() {
  return (
    <header className="border-b border-white/5 backdrop-blur-md bg-surface-900/50 sticky top-0 z-20">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center font-bold text-sm">
            C8
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">CL8Y OTC</h1>
            <p className="text-xs text-gray-500 hidden sm:block">USDC → CL8Y on Terra Classic</p>
          </div>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}
