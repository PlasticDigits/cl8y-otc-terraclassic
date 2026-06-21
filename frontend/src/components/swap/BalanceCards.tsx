import { useWallet } from '../../hooks/useWallet';
import { formatAmount } from '../../utils/format';
import { TOKENS, VYNTREX_MARKET_URLS } from '../../utils/constants';
import { Card, CardContent } from '../common';

export function BalanceCards() {
  const { connected, usdcBalance, cl8yBalance } = useWallet();

  if (!connected) return null;

  return (
    <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in-up">
      <a
        href={VYNTREX_MARKET_URLS.usdc}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:opacity-90 transition-opacity"
      >
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">USDC</p>
            <p className="text-lg font-mono-numbers text-white mt-1">
              {formatAmount(usdcBalance, TOKENS.usdc.decimals)}
            </p>
          </CardContent>
        </Card>
      </a>
      <a
        href={VYNTREX_MARKET_URLS.cl8y}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:opacity-90 transition-opacity"
      >
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">CL8Y</p>
            <p className="text-lg font-mono-numbers text-white mt-1">
              {formatAmount(cl8yBalance, TOKENS.cl8y.decimals, 4)}
            </p>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
