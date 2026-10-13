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

// Table dates drop the year when it's the current one, so columns stay on one line.
export function formatShortDate(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

const ICONS = {
  overview: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  invoice: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5M9 12h8M9 16h8M9 8h3',
  estimate: 'M4 4h16v16H4V4zm4 5h8M8 12h8M8 15h5',
  customers: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-6 1.3-6 4v2h12v-2c0-2.7-3.3-4-6-4zm8 0c-.3 0-.7 0-1 .1 1.2.9 2 2.1 2 3.9v2h5v-2c0-2.7-3.3-4-6-4z',
  services: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
} as const;

export function Icon({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

// A small "⋯" dropdown for secondary actions.
export function Menu({ items, label = 'More actions' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="menu">
      <button
        type="button"
        className="button icon-only"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'menu-item danger' : 'menu-item'}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
