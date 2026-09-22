import { CL8Y_UNIT } from './constants';

/**
 * Compute CL8Y output from USDT input (18-decimal base units).
 * cl8y_out = usdt_in * 10^18 / price (floored)
 * price is USDT base units per 1 whole CL8Y.
 */
export function computeCl8yOut(usdtIn: string, price: string): bigint {
  const usdt = BigInt(usdtIn || '0');
  const rate = BigInt(price || '0');
  if (usdt <= 0n || rate <= 0n) return 0n;
  return (usdt * CL8Y_UNIT) / rate;
}

/** Human-readable CL8Y price in USDT (e.g. 0.70) */
export function priceToUsdtDisplay(priceBase: string): string {
  const p = BigInt(priceBase || '0');
  if (p <= 0n) return '0';
  const whole = p / CL8Y_UNIT;
  const frac = (p % CL8Y_UNIT).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** CL8Y received per 1 USDT at the given price */
export function cl8yPerUsdt(priceBase: string): string {
  const out = computeCl8yOut(CL8Y_UNIT.toString(), priceBase);
  const whole = out / CL8Y_UNIT;
  const frac = (out % CL8Y_UNIT).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Check if connected wallet is contract owner */
export function isOwnerWallet(walletAddress: string | null, ownerAddress: string | null): boolean {
  if (!walletAddress || !ownerAddress) return false;
  return walletAddress.toLowerCase() === ownerAddress.toLowerCase();
}
