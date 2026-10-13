import { describe, expect, it } from 'vitest';
import { addDays, computeTotals, deriveStatus, parseMoneyToCents } from '../shared/totals.ts';

const line = (quantity: number, unitPriceCents: number, taxable = true) => ({ quantity, unitPriceCents, taxable });

describe('computeTotals', () => {
  it('sums lines and applies tax to taxable lines only', () => {
    const totals = computeTotals({
      lines: [line(2, 15000), line(1, 5000, false)],
      discountType: 'none',
      discountValue: 0,
      taxRateBps: 600,
    });

    expect(totals.lineTotalsCents).toEqual([30000, 5000]);
    expect(totals.subtotalCents).toBe(35000);
    expect(totals.taxCents).toBe(1800);
    expect(totals.totalCents).toBe(36800);
  });

  it('rounds fractional quantities per line', () => {
    const totals = computeTotals({
      lines: [line(1.5, 333)],
      discountType: 'none',
      discountValue: 0,
      taxRateBps: 0,
    });

    expect(totals.lineTotalsCents).toEqual([500]);
  });

  it('reduces the taxable base proportionally for an invoice discount', () => {
    const totals = computeTotals({
      lines: [line(1, 10000), line(1, 10000, false)],
      discountType: 'percent',
      discountValue: 1000,
      taxRateBps: 1000,
    });

    expect(totals.discountCents).toBe(2000);
    // Taxable $100 less its 10% share of the discount = $90, taxed at 10%.
    expect(totals.taxCents).toBe(900);
    expect(totals.totalCents).toBe(18900);
  });

  it('never discounts more than the subtotal', () => {
    const totals = computeTotals({ lines: [line(1, 1000)], discountType: 'amount', discountValue: 5000, taxRateBps: 0 });

    expect(totals.discountCents).toBe(1000);
    expect(totals.totalCents).toBe(0);
  });

  it('handles an empty invoice', () => {
    const totals = computeTotals({ lines: [], discountType: 'percent', discountValue: 500, taxRateBps: 800 });

    expect(totals).toMatchObject({ subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 });
  });
});

describe('deriveStatus', () => {
  const base = { kind: 'invoice' as const, dueDate: '2026-05-10', totalCents: 1000, today: '2026-05-01' };

  it.each([
    [{ state: 'draft', paidCents: 0 }, 'draft'],
    [{ state: 'void', paidCents: 0 }, 'void'],
    [{ state: 'sent', paidCents: 0 }, 'unpaid'],
    [{ state: 'sent', paidCents: 400 }, 'partial'],
    [{ state: 'sent', paidCents: 1000 }, 'paid'],
    [{ state: 'sent', paidCents: 400, today: '2026-05-11' }, 'overdue'],
    [{ state: 'sent', paidCents: 1000, today: '2026-05-11' }, 'paid'],
    [{ state: 'sent', paidCents: 0, today: '2026-05-10' }, 'unpaid'],
  ])('%o -> %s', (patch, expected) => {
    expect(deriveStatus({ ...base, ...patch })).toBe(expected);
  });

  it('passes estimate states through', () => {
    expect(deriveStatus({ ...base, kind: 'estimate', state: 'accepted', paidCents: 0 })).toBe('accepted');
  });
});

describe('helpers', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['$1,234.56', 123456],
    ['0.07', 7],
    ['', null],
    ['abc', null],
    ['1.234', null],
  ])('parseMoneyToCents(%s) = %s', (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-25', 14)).toBe('2026-02-08');
    expect(addDays('2026-12-25', 10)).toBe('2027-01-04');
  });
});
