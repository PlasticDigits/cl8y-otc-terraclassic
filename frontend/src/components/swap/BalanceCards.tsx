import { useWallet } from '../../hooks/useWallet';
import { formatAmount } from '../../utils/format';
import { TOKENS } from '../../utils/constants';
import { Card, CardContent } from '../common';

export function BalanceCards() {
  const { connected, usdcBalance, cl8yBalance } = useWallet();

  if (!connected) return null;

  return (
    <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in-up">
      <Card>
        <CardContent className="text-center py-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">USDC</p>
          <p className="text-lg font-mono-numbers text-white mt-1">
            {formatAmount(usdcBalance, TOKENS.usdc.decimals)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="text-center py-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">CL8Y</p>
          <p className="text-lg font-mono-numbers text-white mt-1">
            {formatAmount(cl8yBalance, TOKENS.cl8y.decimals, 4)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
