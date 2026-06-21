import { useState, useCallback } from 'react';

interface CopyableAddressProps {
  address: string;
  label?: string;
  hint?: string;
}

export function CopyableAddress({ address, label, hint = 'Click to copy' }: CopyableAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  }, [address]);

  if (!address) return null;

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-gray-400">{label}</p>
          {copied && <span className="text-xs text-amber-400">Copied!</span>}
        </div>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="w-full text-left text-sm font-mono text-white break-all rounded-xl px-4 py-3 glass border border-white/10 hover:border-amber-400/30 transition-colors cursor-pointer"
        title={hint}
      >
        {address}
      </button>
      {!label && copied && <span className="text-xs text-amber-400 mt-1 block">Copied!</span>}
    </div>
  );
}
