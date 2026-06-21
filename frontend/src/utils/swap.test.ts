import { describe, it, expect } from 'vitest';
import {
  computeCl8yOut,
  priceToUsdcDisplay,
  cl8yPerUsdc,
  isOwnerWallet,
} from './swap';
import { CL8Y_UNIT } from './constants';

describe('computeCl8yOut', () => {
  it('returns 1 CL8Y for 0.70 USDC at default price', () => {
    expect(computeCl8yOut('700000', '700000')).toBe(CL8Y_UNIT);
  });

  it('returns 0 for zero USDC input', () => {
    expect(computeCl8yOut('0', '700000')).toBe(0n);
  });

  it('returns 0 for zero or invalid price', () => {
    expect(computeCl8yOut('700000', '0')).toBe(0n);
    expect(computeCl8yOut('700000', '')).toBe(0n);
  });

  it('floors fractional CL8Y for 1 micro-USDC', () => {
    expect(computeCl8yOut('1', '700000')).toBe(1428571428571n);
  });

  it('returns ~1.428571 CL8Y for 1 USDC at default price', () => {
    expect(computeCl8yOut('1000000', '700000')).toBe(1428571428571428571n);
  });

  it('returns 10 CL8Y for 7 USDC at default price', () => {
    expect(computeCl8yOut('7000000', '700000')).toBe(CL8Y_UNIT * 10n);
  });

  it('returns 1 CL8Y for 1 USDC when price is 1 USDC per CL8Y', () => {
    expect(computeCl8yOut('1000000', '1000000')).toBe(CL8Y_UNIT);
  });

  it('floors just below 1 whole CL8Y', () => {
    const out = computeCl8yOut('699999', '700000');
    expect(out).toBe(999998571428571428n);
    expect(out < CL8Y_UNIT).toBe(true);
  });

  it('scales linearly with USDC input', () => {
    const one = computeCl8yOut('700000', '700000');
    const two = computeCl8yOut('1400000', '700000');
    expect(two).toBe(one * 2n);
  });

  it('matches contract formula for varied prices', () => {
    const cases: [string, string, bigint][] = [
      ['700000', '700000', CL8Y_UNIT],
      ['1000000', '1000000', CL8Y_UNIT],
      ['500000', '1000000', CL8Y_UNIT / 2n],
      ['2000000', '500000', CL8Y_UNIT * 4n],
      ['3', '2', (CL8Y_UNIT * 3n) / 2n],
    ];
    for (const [usdc, price, expected] of cases) {
      expect(computeCl8yOut(usdc, price)).toBe(expected);
    }
  });
});

describe('priceToUsdcDisplay', () => {
  it('formats 700000 as 0.70', () => {
    expect(priceToUsdcDisplay('700000')).toBe('0.7');
  });

  it('formats 1000000 as 1', () => {
    expect(priceToUsdcDisplay('1000000')).toBe('1');
  });
});

describe('cl8yPerUsdc', () => {
  it('returns ~1.428 CL8Y per USDC at 0.70 price', () => {
    const per = cl8yPerUsdc('700000');
    expect(parseFloat(per)).toBeCloseTo(1.428571, 4);
  });
});

describe('isOwnerWallet', () => {
  it('matches case-insensitively', () => {
    expect(
      isOwnerWallet('terra1ABC', 'terra1abc')
    ).toBe(true);
  });

  it('returns false when addresses differ', () => {
    expect(isOwnerWallet('terra1a', 'terra1b')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isOwnerWallet(null, 'terra1a')).toBe(false);
  });
});
