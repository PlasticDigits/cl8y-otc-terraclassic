/**
 * Formatting utilities
 */

import { NETWORKS, DEFAULT_NETWORK } from './constants';

export function formatAmount(
  microAmount: string | number | bigint,
  decimals: number = 6,
  displayDecimals?: number
): string {
  let amount: number;

  if (typeof microAmount === 'bigint') {
    const divisor = BigInt(10 ** decimals);
    const wholePart = microAmount / divisor;
    const fractionalPart = microAmount % divisor;
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    amount = parseFloat(`${wholePart}.${fractionalStr}`);
  } else if (typeof microAmount === 'string') {
    amount = parseFloat(microAmount) / Math.pow(10, decimals);
  } else {
    amount = microAmount / Math.pow(10, decimals);
  }

  const maxDecimals = displayDecimals ?? Math.min(decimals, 6);
  const minDecimals = Math.min(2, maxDecimals);

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

export function parseAmount(humanAmount: string | number, decimals: number = 6): string {
  const amount = typeof humanAmount === 'string' ? parseFloat(humanAmount) : humanAmount;
  if (Number.isNaN(amount) || amount <= 0) return '0';
  return Math.floor(amount * Math.pow(10, decimals)).toString();
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
