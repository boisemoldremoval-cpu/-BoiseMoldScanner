/*
 * Invoice math shared by the server and the browser.
 *
 * All money is integer cents. Percentages (tax rate, percent discounts) are
 * basis points, so 8.25% is 825. Rounding happens once per line and once per
 * discount/tax step, which matches how invoices are usually printed.
 */

export type DiscountType = 'none' | 'percent' | 'amount';

export interface LineInput {
  quantity: number;
  unitPriceCents: number;
  taxable: boolean;
}

export interface TotalsInput {
  lines: LineInput[];
  discountType: DiscountType;

  // Basis points for 'percent', cents for 'amount'.
  discountValue: number;
  taxRateBps: number;
}

export interface Totals {
  lineTotalsCents: number[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export function lineTotalCents(line: LineInput): number {
  return Math.round(line.quantity * line.unitPriceCents);
}

export function computeTotals(input: TotalsInput): Totals {
  const lineTotalsCents = input.lines.map(lineTotalCents);
  const subtotalCents = lineTotalsCents.reduce((sum, value) => sum + value, 0);

  let discountCents = 0;

  if (input.discountType === 'percent') {
    discountCents = Math.round((subtotalCents * input.discountValue) / 10000);
  } else if (input.discountType === 'amount') {
    discountCents = input.discountValue;
  }

  discountCents = Math.max(0, Math.min(discountCents, subtotalCents));

  // The invoice-level discount reduces the taxable base proportionally.
  const taxableCents = input.lines.reduce((sum, line, i) => (line.taxable ? sum + lineTotalsCents[i] : sum), 0);
  const taxableBase = subtotalCents === 0 ? 0 : taxableCents * (1 - discountCents / subtotalCents);
  const taxCents = Math.max(0, Math.round((taxableBase * input.taxRateBps) / 10000));

  return {
    lineTotalsCents,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: subtotalCents - discountCents + taxCents,
  };
}

/*
 * The up-front amount requested before work starts. Percent deposits are
 * basis points of the total; fixed deposits never exceed the total.
 */
export function depositCents(type: DiscountType, value: number, totalCents: number): number {
  if (type === 'percent') {
    return Math.min(totalCents, Math.round((totalCents * value) / 10000));
  }

  if (type === 'amount') {
    return Math.min(totalCents, value);
  }

  return 0;
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'overdue' | 'void';
export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted';

export interface StatusInput {
  kind: 'invoice' | 'estimate';
  state: string;
  dueDate: string | null;
  totalCents: number;
  paidCents: number;

  // YYYY-MM-DD in the business's local time.
  today: string;
}

/*
 * Invoices store only draft/sent/void; paid, partial and overdue are derived
 * from payments and the due date so they never go stale.
 */
export function deriveStatus(input: StatusInput): InvoiceStatus | EstimateStatus {
  if (input.kind === 'estimate') {
    return input.state as EstimateStatus;
  }

  if (input.state === 'draft' || input.state === 'void') {
    return input.state;
  }

  if (input.paidCents >= input.totalCents) {
    return 'paid';
  }

  if (input.dueDate && input.dueDate < input.today) {
    return 'overdue';
  }

  return input.paidCents > 0 ? 'partial' : 'unpaid';
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function parseMoneyToCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '');

  if (cleaned === '' || !/^-?\d*(\.\d{0,2})?$/.test(cleaned)) {
    return null;
  }

  return Math.round(Number(cleaned) * 100);
}

export function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);

  return localDate(new Date(y, m - 1, d + days));
}
