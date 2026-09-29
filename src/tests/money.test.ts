import { describe, it, expect } from 'vitest';
import { formatMoney, parseMoneyToPaise, calculateEqualSplits } from '../lib/money';

describe('Money Engine', () => {
  describe('formatMoney', () => {
    it('formats positive amounts correctly', () => {
      expect(formatMoney(10000)).toBe('₹100');
    });

    it('formats negative amounts correctly', () => {
      expect(formatMoney(-5000)).toBe('-₹50');
    });

    it('formats zero correctly', () => {
      expect(formatMoney(0)).toBe('₹0');
    });
  });

  describe('parseMoneyToPaise', () => {
    it('parses integers correctly', () => {
      expect(parseMoneyToPaise('100')).toBe(10000);
    });

    it('parses floats correctly', () => {
      expect(parseMoneyToPaise('100.50')).toBe(10050);
    });

    it('handles floating point math issues gracefully', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      expect(parseMoneyToPaise('0.3')).toBe(30);
    });

    it('returns 0 for invalid inputs', () => {
      expect(parseMoneyToPaise('abc')).toBe(0);
      expect(parseMoneyToPaise('')).toBe(0);
    });
  });

  describe('calculateEqualSplits', () => {
    it('splits exactly when divisible', () => {
      const splits = calculateEqualSplits(300, ['a', 'b', 'c']);
      expect(splits).toEqual([
        { memberId: 'a', amountPaise: 100 },
        { memberId: 'b', amountPaise: 100 },
        { memberId: 'c', amountPaise: 100 },
      ]);
    });

    it('distributes remainders correctly', () => {
      // 100 split 3 ways is 33, 33, 33 with a remainder of 1
      const splits = calculateEqualSplits(100, ['a', 'b', 'c']);
      expect(splits).toEqual([
        { memberId: 'a', amountPaise: 34 },
        { memberId: 'b', amountPaise: 33 },
        { memberId: 'c', amountPaise: 33 },
      ]);
    });

    it('handles empty members list', () => {
      expect(calculateEqualSplits(100, [])).toEqual([]);
    });

    it('handles large numbers safely', () => {
      // 10,000.00 INR = 1,000,000 paise
      const splits = calculateEqualSplits(1000000, ['a', 'b', 'c']);
      expect(splits).toEqual([
        { memberId: 'a', amountPaise: 333334 },
        { memberId: 'b', amountPaise: 333333 },
        { memberId: 'c', amountPaise: 333333 },
      ]);
    });
  });
});
