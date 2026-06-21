import { useMemo } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { useBuyHistoryStore } from '../../stores/buyHistory';
import { formatAddress, getTxScannerUrl } from '../../utils/format';
import { Card, CardContent } from '../common';

export function BuyHistory() {
  const { address } = useWallet();
  const buys = useBuyHistoryStore((s) => s.buys);

  const walletBuys = useMemo(() => {
    if (!address) return [];
    return buys.filter((b) => b.walletAddress.toLowerCase() === address.toLowerCase());
  }, [buys, address]);

  if (walletBuys.length === 0) return null;

  return (
    <section className="mt-8 animate-fade-in-up">
      <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Past buys</h2>
      <Card>
        <CardContent className="p-0 divide-y divide-white/5">
          <ul>
            {walletBuys.map((buy) => (
              <li
                key={buy.txHash}
                className="flex items-center justify-between gap-3 px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl"
              >
                <span className="text-sm text-white">
                  Bought {buy.cl8yAmount} CL8Y
                </span>
                <a
                  href={getTxScannerUrl(buy.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-amber-400 hover:text-amber-300 underline shrink-0"
                >
                  {formatAddress(buy.txHash, 6)}
                  <span className="sr-only"> (view transaction)</span>
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
