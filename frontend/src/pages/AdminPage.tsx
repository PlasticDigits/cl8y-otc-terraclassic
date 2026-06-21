import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useOtcConfig, useUpdateRate, useUpdateDestination } from '../hooks/useContract';
import { isOwnerWallet, priceToUsdcDisplay } from '../utils/swap';
import { parseAmount } from '../utils/format';
import { TOKENS } from '../utils/constants';
import { Card, CardContent, Button } from '../components/common';

export function AdminPage() {
  const { connected, address } = useWallet();
  const { data: config, isLoading } = useOtcConfig();
  const updateRate = useUpdateRate();
  const updateDestination = useUpdateDestination();

  const [priceInput, setPriceInput] = useState('');
  const [destInput, setDestInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const isOwner = isOwnerWallet(address, config?.owner ?? null);

  if (!connected) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-400">Connect owner wallet to access admin</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <p className="text-gray-400 text-center">Loading config...</p>;
  }

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-white mb-2">Admin Locked</h2>
          <p className="text-gray-400 text-sm">Connected wallet is not the contract owner.</p>
        </CardContent>
      </Card>
    );
  }

  const handleUpdateRate = async () => {
    setMessage(null);
    const micro = parseAmount(priceInput, TOKENS.usdc.decimals);
    try {
      const res = await updateRate.mutateAsync(micro);
      setMessage(`Rate updated: ${res.txHash}`);
      setPriceInput('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleUpdateDest = async () => {
    setMessage(null);
    try {
      const res = await updateDestination.mutateAsync(destInput);
      setMessage(`Destination updated: ${res.txHash}`);
      setDestInput('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white text-center">Owner Admin</h2>

      <Card variant="highlight">
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-400">Current CL8Y price</p>
            <p className="text-xl font-mono-numbers text-amber-400">
              {config ? `${priceToUsdcDisplay(config.price)} USDC per CL8Y` : '—'}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">New price (USDC per CL8Y)</label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.70"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-3 text-white bg-transparent"
            />
          </div>
          <Button
            className="w-full"
            loading={updateRate.isPending}
            disabled={!priceInput}
            onClick={handleUpdateRate}
          >
            Update Price
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-400">USDC destination</p>
            <p className="text-sm font-mono text-white break-all">{config?.destination}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">New destination address</label>
            <input
              type="text"
              placeholder="terra1..."
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-3 text-white bg-transparent"
            />
          </div>
          <Button
            className="w-full"
            variant="secondary"
            loading={updateDestination.isPending}
            disabled={!destInput}
            onClick={handleUpdateDest}
          >
            Update Destination
          </Button>
        </CardContent>
      </Card>

      {message && <p className="text-center text-sm text-amber-400 break-all">{message}</p>}
    </div>
  );
}
