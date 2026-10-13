import { useEffect, useState, type ReactNode } from 'react';
import { formatCents, parseMoneyToCents } from '../shared/totals.ts';
import type { BusinessSettings, DocumentDetail } from '../shared/types.ts';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  converted: 'Invoiced',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/*
 * Edits a cents value as a dollar string. The text is kept locally while
 * typing so partial input such as "12." isn't reformatted under the cursor.
 */
export function MoneyInput({
  valueCents,
  onChange,
  ...rest
}: {
  valueCents: number;
  onChange: (cents: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const [text, setText] = useState(() => (valueCents / 100).toFixed(2));

  useEffect(() => {
    if (parseMoneyToCents(text) !== valueCents) {
      setText((valueCents / 100).toFixed(2));
    }
    // Only resync when the value changes from outside.
  }, [valueCents]);

  return (
    <input
      {...rest}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const cents = parseMoneyToCents(e.target.value);

        if (cents !== null && cents >= 0) {
          onChange(cents);
        }
      }}
      onBlur={() => setText((valueCents / 100).toFixed(2))}
    />
  );
}

export function percentFromBps(bps: number): string {
  return String(Number((bps / 100).toFixed(3)));
}

export function bpsFromPercent(value: string): number | null {
  const n = Number(value);

  return value.trim() === '' || !Number.isFinite(n) || n < 0 || n > 100 ? null : Math.round(n * 100);
}

export function formatDate(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);

  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export function methodLabel(method: string) {
  return METHOD_LABELS[method] ?? method;
}

// The printable invoice/estimate, shared by the owner view and the customer link.
export function DocumentPaper({ doc, business }: { doc: DocumentDetail; business: BusinessSettings }) {
  const isInvoice = doc.kind === 'invoice';
  const title = isInvoice ? 'Invoice' : 'Estimate';

  return (
    <article className="paper">
      <header className="paper-header">
        <div>
          <div className="paper-business">{business.name || 'Your business name'}</div>
          <div className="paper-muted pre">
            {[business.address, business.phone, business.email, business.website].filter(Boolean).join('\n')}
          </div>
          {business.license && <div className="paper-muted">License #{business.license}</div>}
        </div>
        <div className="paper-meta">
          <div className="paper-title">{title}</div>
          <div className="paper-number">{doc.number}</div>
          <StatusBadge status={doc.status} />
        </div>
      </header>

      <section className="paper-parties">
        <div>
          <div className="paper-label">Bill to</div>
          {doc.customer ? (
            <>
              <div className="strong">{doc.customer.name}</div>
              {doc.customer.company && <div>{doc.customer.company}</div>}
              <div className="paper-muted pre">
                {[doc.customer.address, doc.customer.phone, doc.customer.email].filter(Boolean).join('\n')}
              </div>
            </>
          ) : (
            <div className="paper-muted">No customer selected</div>
          )}
        </div>
        {doc.serviceAddress && (
          <div>
            <div className="paper-label">Service address</div>
            <div className="pre">{doc.serviceAddress}</div>
          </div>
        )}
        <dl className="paper-dates">
          <dt>Issued</dt>
          <dd>{formatDate(doc.issueDate)}</dd>
          {doc.dueDate && (
            <>
              <dt>{isInvoice ? 'Due' : 'Valid until'}</dt>
              <dd>{formatDate(doc.dueDate)}</dd>
            </>
          )}
        </dl>
      </section>

      {doc.title && <h2 className="paper-subject">{doc.title}</h2>}

      <table className="paper-lines">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line, i) => (
            <tr key={line.id ?? i}>
              <td>
                <div className="strong">{line.name}</div>
                {line.description && <div className="paper-muted pre">{line.description}</div>}
              </td>
              <td className="num nowrap">
                {line.quantity} {line.unit}
              </td>
              <td className="num">{formatCents(line.unitPriceCents)}</td>
              <td className="num">{formatCents(doc.totals.lineTotalsCents[i])}</td>
            </tr>
          ))}
          {doc.lines.length === 0 && (
            <tr>
              <td colSpan={4} className="paper-muted">
                No line items
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <table className="paper-totals">
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td className="num">{formatCents(doc.totals.subtotalCents)}</td>
          </tr>
          {doc.totals.discountCents > 0 && (
            <tr>
              <td>Discount{doc.discountType === 'percent' ? ` (${percentFromBps(doc.discountValue)}%)` : ''}</td>
              <td className="num">−{formatCents(doc.totals.discountCents)}</td>
            </tr>
          )}
          {doc.taxRateBps > 0 && (
            <tr>
              <td>Tax ({percentFromBps(doc.taxRateBps)}%)</td>
              <td className="num">{formatCents(doc.totals.taxCents)}</td>
            </tr>
          )}
          <tr className="total-row">
            <td>Total</td>
            <td className="num">{formatCents(doc.totals.totalCents)}</td>
          </tr>
          {isInvoice && doc.paidCents > 0 && (
            <tr>
              <td>Paid</td>
              <td className="num">−{formatCents(doc.paidCents)}</td>
            </tr>
          )}
          {isInvoice && (
            <tr className="balance-row">
              <td>Balance due</td>
              <td className="num">{formatCents(doc.balanceCents)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {isInvoice && business.paymentInstructions && doc.balanceCents > 0 && (
        <section className="paper-section">
          <div className="paper-label">How to pay</div>
          <div className="pre">{business.paymentInstructions}</div>
        </section>
      )}
      {doc.notes && (
        <section className="paper-section">
          <div className="paper-label">Notes</div>
          <div className="pre">{doc.notes}</div>
        </section>
      )}
      {doc.terms && (
        <section className="paper-section">
          <div className="paper-label">Terms</div>
          <div className="pre paper-muted">{doc.terms}</div>
        </section>
      )}
    </article>
  );
}
