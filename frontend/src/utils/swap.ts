import { CL8Y_UNIT } from './constants';

/**
 * Compute CL8Y output from USDC input (micro units).
 * cl8y_out = usdc_in_micro * 10^18 / price (floored)
 */
export function computeCl8yOut(usdcInMicro: string, priceMicro: string): bigint {
  const usdc = BigInt(usdcInMicro || '0');
  const price = BigInt(priceMicro || '0');
  if (usdc <= 0n || price <= 0n) return 0n;
  return (usdc * CL8Y_UNIT) / price;
}

/** Human-readable CL8Y price in USDC (e.g. 0.70) */
export function priceToUsdcDisplay(priceMicro: string): string {
  const p = BigInt(priceMicro || '0');
  if (p <= 0n) return '0';
  const whole = p / 1_000_000n;
  const frac = (p % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** CL8Y received per 1 USDC at given price */
export function cl8yPerUsdc(priceMicro: string): string {
  const out = computeCl8yOut('1000000', priceMicro);
  const whole = out / CL8Y_UNIT;
  const frac = (out % CL8Y_UNIT).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Check if connected wallet is contract owner */
export function isOwnerWallet(walletAddress: string | null, ownerAddress: string | null): boolean {
  if (!walletAddress || !ownerAddress) return false;
  return walletAddress.toLowerCase() === ownerAddress.toLowerCase();
}
