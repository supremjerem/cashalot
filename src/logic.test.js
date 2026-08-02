import { describe, it, expect } from 'vitest';
import {
  MONTHS,
  uid,
  seedData,
  normalizeState,
  fmt,
  monthsBetween,
  computeTotals,
  loanProgressPct,
  loanProgressLabel
} from './logic.js';

describe('MONTHS', () => {
  it('has 12 months', () => {
    expect(MONTHS).toHaveLength(12);
  });
});

describe('uid', () => {
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uid()));
    expect(ids.size).toBe(50);
  });
});

describe('seedData', () => {
  it('produces non-empty income, recurring, and loan lists with unique ids', () => {
    const data = seedData();
    expect(data.income.length).toBeGreaterThan(0);
    expect(data.recurring.length).toBeGreaterThan(0);
    expect(data.loans.length).toBeGreaterThan(0);

    const ids = data.income.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('normalizeState', () => {
  it('defaults to an empty cards view when given nothing', () => {
    const result = normalizeState();
    expect(result.view).toBe('cards');
    expect(result.income).toEqual([]);
  });

  it('reads the current English-keyed schema', () => {
    const result = normalizeState({ view: 'compact', income: [{ id: '1' }] });
    expect(result.view).toBe('compact');
    expect(result.income).toEqual([{ id: '1' }]);
  });

  it('falls back to the legacy French-keyed schema', () => {
    const result = normalizeState({ revenus: [{ id: '1' }], credits: [{ id: '2' }] });
    expect(result.income).toEqual([{ id: '1' }]);
    expect(result.loans).toEqual([{ id: '2' }]);
  });

  it('ignores non-array legacy values', () => {
    const result = normalizeState({ revenus: 'not-an-array' });
    expect(result.income).toEqual([]);
  });
});

describe('fmt', () => {
  it('formats a positive amount as rounded EUR', () => {
    expect(fmt(1234.6).replace(/\s/g, '')).toBe('1235€');
  });

  it('formats zero, NaN, and undefined as 0 €', () => {
    expect(fmt(0).replace(/\s/g, '')).toBe('0€');
    expect(fmt(NaN).replace(/\s/g, '')).toBe('0€');
    expect(fmt(undefined).replace(/\s/g, '')).toBe('0€');
  });
});

describe('monthsBetween', () => {
  it('counts whole months between two dates in the same year', () => {
    expect(monthsBetween(new Date('2026-01-15'), new Date('2026-04-15'))).toBe(3);
  });

  it('counts across year boundaries', () => {
    expect(monthsBetween(new Date('2025-11-01'), new Date('2026-02-01'))).toBe(3);
  });

  it('returns 0 for the same date', () => {
    expect(monthsBetween(new Date('2026-01-15'), new Date('2026-01-15'))).toBe(0);
  });
});

describe('computeTotals', () => {
  const baseState = {
    income: [{ amount: 2000 }, { amount: 300 }],
    recurring: [{ amount: 500 }],
    loans: [{ amount: 700 }],
    savings: [{ amount: 200 }],
    oneOff: [{ amount: 1200 }],
    quarterly: [{ amount: 100, occurrences: 4 }]
  };

  it('computes income, expenses, and remaining balance', () => {
    const totals = computeTotals(baseState);
    expect(totals.totalIn).toBe(2300);
    expect(totals.totalOut).toBe(1200);
    expect(totals.totalSavings).toBe(200);
    expect(totals.remainingBeforeSavings).toBe(1100);
    expect(totals.remainingAfterSavings).toBe(900);
  });

  it('smooths one-off and quarterly charges over 12 months', () => {
    const totals = computeTotals(baseState);
    expect(totals.monthlyOneOff).toBe(100);
    expect(totals.monthlyQuarterly).toBeCloseTo(33.33, 1);
    expect(totals.smoothedRemaining).toBeCloseTo(900 - 100 - 33.33, 1);
  });

  it('treats invalid or missing amounts as zero', () => {
    const totals = computeTotals({
      income: [{ amount: 'nope' }, {}],
      recurring: [],
      loans: [],
      savings: [],
      oneOff: [],
      quarterly: []
    });
    expect(totals.totalIn).toBe(0);
  });

  it('defaults missing occurrences to 1 for quarterly items', () => {
    const totals = computeTotals({
      income: [],
      recurring: [],
      loans: [],
      savings: [],
      oneOff: [],
      quarterly: [{ amount: 50 }]
    });
    expect(totals.totalQuarterly).toBe(50);
  });
});

describe('loan progress', () => {
  const today = new Date('2026-01-01');

  it('reports 0% progress for a loan that just started', () => {
    const item = { totalMonths: 240, endDate: '2046-01-01' };
    expect(loanProgressPct(item, today)).toBe(0);
    expect(loanProgressLabel(item, today)).toBe('0 / 240 months');
  });

  it('reports partial progress mid-loan', () => {
    const item = { totalMonths: 48, endDate: '2028-01-01' };
    expect(loanProgressPct(item, today)).toBe(50);
    expect(loanProgressLabel(item, today)).toBe('24 / 48 months');
  });

  it('clamps progress at 100% once the loan end date has passed', () => {
    const item = { totalMonths: 12, endDate: '2020-01-01' };
    expect(loanProgressPct(item, today)).toBe(100);
    expect(loanProgressLabel(item, today)).toBe('12 / 12 months');
  });
});
