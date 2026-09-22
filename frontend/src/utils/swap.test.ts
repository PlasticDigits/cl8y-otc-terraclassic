import { describe, it, expect } from 'vitest';
import {
  computeCl8yOut,
  priceToUsdtDisplay,
  cl8yPerUsdt,
  isOwnerWallet,
} from './swap';
import { parseAmount, formatAmount } from './format';
import { CL8Y_UNIT, DEFAULT_PRICE } from './constants';

const ONE_USDT = CL8Y_UNIT.toString();

describe('computeCl8yOut', () => {
  it('returns 1 CL8Y for 0.70 USDT at default price', () => {
    expect(computeCl8yOut(DEFAULT_PRICE, DEFAULT_PRICE)).toBe(CL8Y_UNIT);
  });

  it('returns 0 for zero USDT input', () => {
    expect(computeCl8yOut('0', DEFAULT_PRICE)).toBe(0n);
  });

  it('returns 0 for zero or invalid price', () => {
    expect(computeCl8yOut(DEFAULT_PRICE, '0')).toBe(0n);
    expect(computeCl8yOut(DEFAULT_PRICE, '')).toBe(0n);
  });

  it('floors 1 base unit at the default price to 1', () => {
    expect(computeCl8yOut('1', DEFAULT_PRICE)).toBe(1n);
  });

  it('returns ~1.428571 CL8Y for 1 USDT at default price', () => {
    expect(computeCl8yOut(ONE_USDT, DEFAULT_PRICE)).toBe(1428571428571428571n);
  });

  it('returns 10 CL8Y for 7 USDT at default price', () => {
    expect(computeCl8yOut((CL8Y_UNIT * 7n).toString(), DEFAULT_PRICE)).toBe(CL8Y_UNIT * 10n);
  });

  it('returns 1 CL8Y for 1 USDT when price is 1 USDT per CL8Y', () => {
    expect(computeCl8yOut(ONE_USDT, ONE_USDT)).toBe(CL8Y_UNIT);
  });

  it('floors just below 1 whole CL8Y', () => {
    const out = computeCl8yOut((BigInt(DEFAULT_PRICE) - 1n).toString(), DEFAULT_PRICE);
    expect(out).toBe(CL8Y_UNIT - 2n);
    expect(out < CL8Y_UNIT).toBe(true);
  });

  it('scales linearly with USDT input', () => {
    const one = computeCl8yOut(DEFAULT_PRICE, DEFAULT_PRICE);
    const two = computeCl8yOut((BigInt(DEFAULT_PRICE) * 2n).toString(), DEFAULT_PRICE);
    expect(two).toBe(one * 2n);
  });

  it('matches contract formula for varied prices', () => {
    const cases: [string, string, bigint][] = [
      [DEFAULT_PRICE, DEFAULT_PRICE, CL8Y_UNIT],
      [ONE_USDT, ONE_USDT, CL8Y_UNIT],
      [(CL8Y_UNIT / 2n).toString(), ONE_USDT, CL8Y_UNIT / 2n],
      [(CL8Y_UNIT * 4n).toString(), (CL8Y_UNIT / 2n).toString(), CL8Y_UNIT * 8n],
      ['3', '2', (CL8Y_UNIT * 3n) / 2n],
    ];
    for (const [usdt, price, expected] of cases) {
      expect(computeCl8yOut(usdt, price)).toBe(expected);
    }
  });
});

describe('priceToUsdtDisplay', () => {
  it('formats 0.70 USDT', () => {
    expect(priceToUsdtDisplay(DEFAULT_PRICE)).toBe('0.7');
  });

  it('formats 1 USDT', () => {
    expect(priceToUsdtDisplay(ONE_USDT)).toBe('1');
  });
});

describe('cl8yPerUsdt', () => {
  it('returns ~1.428 CL8Y per USDT at 0.70 price', () => {
    const per = cl8yPerUsdt(DEFAULT_PRICE);
    expect(parseFloat(per)).toBeCloseTo(1.428571, 4);
  });
});

describe('18 decimal amounts', () => {
  it('parses 0.70 USDT into 7e17 base units', () => {
    expect(parseAmount('0.70', 18)).toBe(DEFAULT_PRICE);
    expect(parseAmount('0.7', 18)).toBe(DEFAULT_PRICE);
  });

  it('formats 1 CL8Y base units as 1.00', () => {
    expect(formatAmount(CL8Y_UNIT.toString(), 18, 6)).toBe('1.00');
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
