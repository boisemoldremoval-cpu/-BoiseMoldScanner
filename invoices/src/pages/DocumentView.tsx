import { useState } from 'react';
import { formatCents, localDate } from '../../shared/totals.ts';
import type { BusinessSettings, DocumentDetail } from '../../shared/types.ts';
import { del, post } from '../api.ts';
import {
  DocumentPaper,
  Field,
  Menu,
  MoneyInput,
  StatusBadge,
  formatDate,
  formatShortDate,
  methodLabel,
  type MenuItem,
} from '../components.tsx';
import { useFetch } from '../hooks.ts';
import { navigate } from '../router.ts';

export function publicLink(doc: DocumentDetail) {
  return `${window.location.origin}/#/i/${doc.publicToken}`;
}

export function DocumentView({ id }: { id: number }) {
  const { data: doc, setData: setDoc, error } = useFetch<DocumentDetail>(`/documents/${id}`);
  const { data: business } = useFetch<BusinessSettings>('/settings');
  const [modal, setModal] = useState<'share' | 'payment' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!doc || !business) {
    return <p className="muted">Loading…</p>;
  }

  const run = async (action: () => Promise<DocumentDetail | void>) => {
    setActionError(null);

    try {
      const result = await action();

      if (result) {
        setDoc(result);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  const isInvoice = doc.kind === 'invoice';
  const editable = doc.state !== 'void' && doc.state !== 'converted';
  const canPay = isInvoice && doc.state !== 'void' && doc.balanceCents > 0;
  const canConvert = doc.kind === 'estimate' && doc.state !== 'converted';
  const setState = (state: string) => run(() => post<DocumentDetail>(`/documents/${doc.id}/state`, { state }));
  const send = () =>
    run(async () => {
      const updated = doc.state === 'draft' ? await post<DocumentDetail>(`/documents/${doc.id}/state`, { state: 'sent' }) : doc;
      setModal('share');

      return updated;
    });
  const convert = () =>
    run(async () => {
      const invoice = await post<DocumentDetail>(`/documents/${doc.id}/convert`);
      navigate(`/invoices/${invoice.id}`);
    });

  // Accepted estimates are ready to bill, so converting becomes the main action.
  const convertIsPrimary = canConvert && doc.state === 'accepted';

  const menu: MenuItem[] = [
    { label: 'Print / Save PDF', onSelect: () => window.print() },
    ...(doc.kind === 'estimate' && doc.state === 'sent'
      ? [
          { label: 'Mark accepted', onSelect: () => setState('accepted') },
          { label: 'Mark declined', onSelect: () => setState('declined') },
        ]
      : []),
    ...(canConvert && !convertIsPrimary ? [{ label: 'Convert to invoice', onSelect: convert }] : []),
    {
      label: 'Duplicate',
      onSelect: () =>
        run(async () => {
          const copy = await post<DocumentDetail>(`/documents/${doc.id}/duplicate`);
          navigate(`/${copy.kind}s/${copy.id}/edit`);
        }),
    },
    ...(isInvoice && doc.state === 'sent'
      ? [
          {
            label: 'Void invoice',
            danger: true,
            onSelect: () => {
              if (confirm(`Void ${doc.number}? It will stay in your records but can't be paid or edited.`)) {
                setState('void');
              }
            },
          },
        ]
      : []),
    ...(doc.state === 'draft'
      ? [
          {
            label: 'Delete draft',
            danger: true,
            onSelect: () => {
              if (confirm(`Delete draft ${doc.number}?`)) {
                run(async () => {
                  await del(`/documents/${doc.id}`);
                  navigate(`/${doc.kind}s`);
                });
              }
            },
          },
        ]
      : []),
  ];

  return (
    <div className="stack">
      <div className="page-header no-print">
        <div>
          <a href={`#/${doc.kind}s`} className="back-link">
            ← {isInvoice ? 'Invoices' : 'Estimates'}
          </a>
          <div className="title-row">
            <h1>{doc.number}</h1>
            <StatusBadge status={doc.status} />
          </div>
          {doc.customerName && <div className="muted">{doc.customerName}</div>}
        </div>
        <div className="actions">
          {editable && (
            <a className="button" href={`#/${doc.kind}s/${doc.id}/edit`}>
              Edit
            </a>
          )}
          {canPay && (
            <button className="button" onClick={() => setModal('payment')}>
              Record payment
            </button>
          )}
          {convertIsPrimary ? (
            <button className="button primary" onClick={convert}>
              Convert to invoice
            </button>
          ) : (
            editable && (
              <button className="button primary" onClick={send}>
                {doc.state === 'draft' ? 'Send' : 'Share link'}
              </button>
            )
          )}
          <Menu items={menu} />
        </div>
      </div>

      {actionError && <p className="error no-print">{actionError}</p>}

      {doc.kind === 'estimate' && doc.state === 'converted' && doc.convertedToId && (
        <p className="notice no-print">
          Converted to an invoice. <a href={`#/invoices/${doc.convertedToId}`}>Open invoice →</a>
        </p>
      )}
      {doc.sourceEstimateId && (
        <p className="muted small no-print">
          Created from <a href={`#/estimates/${doc.sourceEstimateId}`}>an estimate</a>.
        </p>
      )}

      <div className={isInvoice ? 'view-layout' : 'view-single'}>
        <DocumentPaper doc={doc} business={business} />

        {isInvoice && (
          <aside className="card stack-sm no-print">
            <div className="card-header">
              <h2>Payments</h2>
              {canPay && (
                <button className="link-button" onClick={() => setModal('payment')}>
                  + Add
                </button>
              )}
            </div>
            {doc.payments.length === 0 && <p className="muted small">No payments yet.</p>}
            {doc.payments.map((payment) => (
              <div key={payment.id} className="payment">
                <div>
                  <div className="strong">{formatCents(payment.amountCents)}</div>
                  <div className="muted small">
                    {methodLabel(payment.method)} · {formatShortDate(payment.paidAt)}
                    {payment.note && ` · ${payment.note}`}
                  </div>
                </div>
                <button
                  className="link-button danger small"
                  onClick={() =>
                    confirm('Remove this payment?') &&
                    run(() => del<DocumentDetail>(`/documents/${doc.id}/payments/${payment.id}`))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="payment-summary">
              <span>Balance due</span>
              <span className="strong">{formatCents(doc.balanceCents)}</span>
            </div>
          </aside>
        )}
      </div>

      {modal === 'share' && <ShareModal doc={doc} business={business} onClose={() => setModal(null)} />}
      {modal === 'payment' && (
        <PaymentModal
          doc={doc}
          onClose={() => setModal(null)}
          onSaved={(updated) => {
            setDoc(updated);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function ShareModal({ doc, business, onClose }: { doc: DocumentDetail; business: BusinessSettings; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = publicLink(doc);
  const label = doc.kind === 'invoice' ? 'invoice' : 'estimate';
  const from = business.name || 'us';
  const amount = formatCents(doc.kind === 'invoice' ? doc.balanceCents : doc.totalCents);
  const subject = `${doc.kind === 'invoice' ? 'Invoice' : 'Estimate'} ${doc.number} from ${from}`;
  const body =
    `Hi${doc.customer ? ` ${doc.customer.name.split(' ')[0]}` : ''},\n\n` +
    `Here is your ${label} ${doc.number} for ${amount}` +
    (doc.kind === 'invoice' && doc.dueDate ? `, due ${formatDate(doc.dueDate)}` : '') +
    `.\n\nView it here: ${link}\n\nThank you,\n${business.name}`;
  const sms = `${subject}: ${amount}. View: ${link}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal stack-sm" role="dialog" aria-label="Share" onClick={(e) => e.stopPropagation()}>
        <h2>Send {label}</h2>
        <p className="muted small">Anyone with this link can view the {label}. Drafts are never visible.</p>
        <div className="row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Customer link" />
          <button
            className="button"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="row wrap">
          <a
            className="button primary"
            href={`mailto:${encodeURIComponent(doc.customer?.email ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
          >
            Email{doc.customer?.email ? ` ${doc.customer.email}` : ''}
          </a>
          {doc.customer?.phone && (
            <a className="button" href={`sms:${doc.customer.phone}?&body=${encodeURIComponent(sms)}`}>
              Text {doc.customer.phone}
            </a>
          )}
          <a className="button" href={link} target="_blank" rel="noreferrer">
            Preview
          </a>
        </div>
        <div className="actions">
          <button className="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({
  doc,
  onClose,
  onSaved,
}: {
  doc: DocumentDetail;
  onClose: () => void;
  onSaved: (doc: DocumentDetail) => void;
}) {
  const [amountCents, setAmountCents] = useState(doc.balanceCents);
  const [method, setMethod] = useState('check');
  const [paidAt, setPaidAt] = useState(localDate());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal stack-sm"
        role="dialog"
        aria-label="Record payment"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();

          try {
            onSaved(await post<DocumentDetail>(`/documents/${doc.id}/payments`, { amountCents, method, paidAt, note }));
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      >
        <h2>Record payment</h2>
        <p className="muted small">Balance due: {formatCents(doc.balanceCents)}</p>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <Field label="Amount">
            <MoneyInput valueCents={amountCents} onChange={setAmountCents} autoFocus />
          </Field>
          <Field label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="check">Check</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Note" hint="e.g. check number">
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            Record {formatCents(amountCents)}
          </button>
        </div>
      </form>
    </div>
  );
}
