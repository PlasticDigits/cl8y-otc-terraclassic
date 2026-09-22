import { useWallet } from '../../hooks/useWallet';
import { formatAmount, getAddressScannerUrl } from '../../utils/format';
import { TOKENS, VYNTREX_MARKET_URLS } from '../../utils/constants';
import { Card, CardContent } from '../common';

export function BalanceCards() {
  const { connected, usdtBalance, cl8yBalance } = useWallet();

  if (!connected) return null;

  return (
    <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in-up">
      <a
        href={getAddressScannerUrl(TOKENS.usdt.address)}
        target="_blank"
        rel="noopener noreferrer"
        className="group block hover:opacity-90 transition-opacity"
      >
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-xs text-amber-400 group-hover:text-amber-300 uppercase tracking-wide underline">
              USDT <span aria-hidden="true">↗</span>
            </p>
            <p className="text-lg font-mono-numbers text-white mt-1">
              {formatAmount(usdtBalance, TOKENS.usdt.decimals)}
            </p>
          </CardContent>
        </Card>
      </a>
      <a
        href={VYNTREX_MARKET_URLS.cl8y}
        target="_blank"
        rel="noopener noreferrer"
        className="group block hover:opacity-90 transition-opacity"
      >
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-xs text-amber-400 group-hover:text-amber-300 uppercase tracking-wide underline">
              CL8Y <span aria-hidden="true">↗</span>
            </p>
            <p className="text-lg font-mono-numbers text-white mt-1">
              {formatAmount(cl8yBalance, TOKENS.cl8y.decimals, 4)}
            </p>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
