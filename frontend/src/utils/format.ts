/**
 * Formatting utilities
 */

import { NETWORKS, DEFAULT_NETWORK } from './constants';

export function formatAmount(
  microAmount: string | number | bigint,
  decimals: number = 6,
  displayDecimals?: number
): string {
  const maxDecimals = Math.min(displayDecimals ?? Math.min(decimals, 6), decimals);
  const minDecimals = Math.min(2, maxDecimals);

  let negative = false;
  let amount: bigint;
  if (typeof microAmount === 'bigint') {
    negative = microAmount < 0n;
    amount = negative ? -microAmount : microAmount;
  } else if (typeof microAmount === 'number') {
    if (!Number.isFinite(microAmount)) return minDecimals > 0 ? `0.${'0'.repeat(minDecimals)}` : '0';
    negative = microAmount < 0;
    amount = BigInt(Math.trunc(Math.abs(microAmount)));
  } else {
    const trimmed = microAmount.trim();
    if (!/^-?\d+$/.test(trimmed)) return minDecimals > 0 ? `0.${'0'.repeat(minDecimals)}` : '0';
    negative = trimmed.startsWith('-');
    amount = BigInt(negative ? trimmed.slice(1) : trimmed);
  }

  let places = decimals;
  if (maxDecimals < decimals) {
    const shift = 10n ** BigInt(decimals - maxDecimals);
    amount = (amount + shift / 2n) / shift;
    places = maxDecimals;
  }

  const base = places === 0 ? 1n : 10n ** BigInt(places);
  const whole = amount / base;
  let frac = places === 0 ? '' : (amount % base).toString().padStart(places, '0');
  frac = frac.replace(/0+$/, '');
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0');

  const body = frac
    ? `${whole.toLocaleString('en-US')}.${frac}`
    : whole.toLocaleString('en-US');
  return negative ? `-${body}` : body;
}

/** Parse a human decimal amount into base units without binary float rounding. */
export function parseAmount(humanAmount: string | number, decimals: number = 18): string {
  if (typeof humanAmount === 'number') {
    if (!Number.isFinite(humanAmount) || humanAmount <= 0) return '0';
    return parseDecimalString(humanAmount.toString(), decimals);
  }
  return parseDecimalString(humanAmount.trim(), decimals);
}

function parseDecimalString(raw: string, decimals: number): string {
  if (!raw || decimals < 0) return '0';
  const match = raw.match(/^(\d*)(?:\.(\d*))?$/);
  if (!match) return '0';
  let whole = match[1] ?? '';
  let frac = match[2] ?? '';
  if (whole === '' && frac === '') return '0';
  if (whole === '') whole = '0';
  if (frac.length > decimals) frac = frac.slice(0, decimals);
  else frac = frac.padEnd(decimals, '0');
  const combined = `${whole}${frac}`.replace(/^0+/, '');
  return combined === '' ? '0' : combined;
}

export function formatRate(rate: string | number, decimals: number = 4): string {
  const rateNum = typeof rate === 'string' ? parseFloat(rate) : rate;
  return rateNum.toFixed(decimals);
}

export function formatAddress(address: string, chars: number = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function getScannerUrl(): string {
  return NETWORKS[DEFAULT_NETWORK].scanner;
}

export function getAddressScannerUrl(address: string): string {
  return `${getScannerUrl()}/address/${address}`;
}

export function getTxScannerUrl(txHash: string): string {
  return `${getScannerUrl()}/tx/${txHash}`;
}
