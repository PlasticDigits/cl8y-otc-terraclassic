import { useState, useMemo } from 'react';
import { Card, CardContent, Button } from '../common';
import { useWallet } from '../../hooks/useWallet';
import { useOtcCl8yBalance, useOtcConfig, useSwap } from '../../hooks/useContract';
import { formatAmount, parseAmount } from '../../utils/format';
import { computeCl8yOut, priceToUsdcDisplay, cl8yPerUsdc } from '../../utils/swap';
import { TOKENS } from '../../utils/constants';
import { useBuyHistoryStore } from '../../stores/buyHistory';
import { SwapSuccessPopover } from './SwapSuccessPopover';

export function SwapCard() {
  const { connected, address, usdcBalance, refreshBalances } = useWallet();
  const { data: config } = useOtcConfig();
  const { data: otcCl8yBalance } = useOtcCl8yBalance();
  const swap = useSwap();
  const addBuy = useBuyHistoryStore((s) => s.addBuy);

  const [usdcInput, setUsdcInput] = useState('');
  const [successCl8yAmount, setSuccessCl8yAmount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const price = config?.price || '700000';
  const usdcMicro = useMemo(() => parseAmount(usdcInput, TOKENS.usdc.decimals), [usdcInput]);
  const cl8yOut = useMemo(() => computeCl8yOut(usdcMicro, price).toString(), [usdcMicro, price]);

  const canSwap =
    connected &&
    BigInt(usdcMicro || '0') > 0n &&
    BigInt(usdcMicro || '0') <= BigInt(usdcBalance || '0') &&
    !swap.isPending;

  const handleSwap = async () => {
    setError(null);
    setSuccessCl8yAmount(null);
    const boughtCl8y = formatAmount(cl8yOut, TOKENS.cl8y.decimals, 2);
    try {
      const result = await swap.mutateAsync(usdcMicro);
      setSuccessCl8yAmount(boughtCl8y);
      if (address) {
        addBuy({ txHash: result.txHash, cl8yAmount: boughtCl8y, walletAddress: address });
      }
      setUsdcInput('');
      await refreshBalances();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swap failed');
    }
  };

  return (
    <>
      {successCl8yAmount && (
        <SwapSuccessPopover
          cl8yAmount={successCl8yAmount}
          onClose={() => setSuccessCl8yAmount(null)}
        />
      )}
      <Card variant="highlight" className="animate-fade-in-up">
        <CardContent className="space-y-4">
        <div className="text-center space-y-1">
          <p className="text-sm text-gray-400">Rate</p>
          <p className="text-xl font-mono-numbers text-amber-400">
            1 CL8Y = {priceToUsdcDisplay(price)} USDC
          </p>
          <p className="text-xs text-gray-500">1 USDC ≈ {cl8yPerUsdc(price)} CL8Y</p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">You pay</span>
            <div className="glass border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={usdcInput}
                onChange={(e) => setUsdcInput(e.target.value)}
                className="bg-transparent text-2xl font-mono-numbers text-white w-full outline-none"
              />
              <span className="text-amber-400 font-semibold ml-2">USDC</span>
            </div>
            {connected && (
              <p className="text-xs text-gray-500 mt-1">
                Balance: {formatAmount(usdcBalance, 6)} USDC
              </p>
            )}
          </label>

          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-gray-400">
              ↓
            </div>
          </div>

          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">You receive</span>
            <div className="glass border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <span className="text-2xl font-mono-numbers text-white">
                {usdcInput ? formatAmount(cl8yOut, 18, 6) : '0.00'}
              </span>
              <span className="text-amber-400 font-semibold ml-2">CL8Y</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Max: {formatAmount(otcCl8yBalance ?? '0', TOKENS.cl8y.decimals, 6)}
            </p>
          </label>
        </div>

        <Button
          className="w-full"
          size="lg"
          loading={swap.isPending}
          disabled={!canSwap}
          onClick={handleSwap}
        >
          OTC SWAP
        </Button>

        {!connected && (
          <p className="text-center text-sm text-gray-500">Connect wallet to swap</p>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </CardContent>
      </Card>
    </>
  );
}
