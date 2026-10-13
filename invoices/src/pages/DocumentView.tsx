import { useState } from 'react';
import { formatCents, localDate } from '../../shared/totals.ts';
import type { BusinessSettings, DocumentDetail } from '../../shared/types.ts';
import { del, post } from '../api.ts';
import { DocumentPaper, Field, MoneyInput, formatDate, methodLabel } from '../components.tsx';
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

  return (
    <div className="stack">
      <div className="page-header no-print">
        <div>
          <a href={`#/${doc.kind}s`} className="muted small">
            ← {isInvoice ? 'Invoices' : 'Estimates'}
          </a>
          <h1>
            {doc.number} {doc.customerName && <span className="muted">· {doc.customerName}</span>}
          </h1>
        </div>
        <div className="actions wrap">
          {editable && (
            <a className="button" href={`#/${doc.kind}s/${doc.id}/edit`}>
              Edit
            </a>
          )}
          <button className="button" onClick={() => window.print()}>
            Print / PDF
          </button>
          {canPay && (
            <button className="button" onClick={() => setModal('payment')}>
              Record payment
            </button>
          )}
          {editable && (
            <button
              className="button primary"
              onClick={() =>
                run(async () => {
                  const updated =
                    doc.state === 'draft' ? await post<DocumentDetail>(`/documents/${doc.id}/state`, { state: 'sent' }) : doc;
                  setModal('share');

                  return updated;
                })
              }
            >
              {doc.state === 'draft' ? 'Send' : 'Share'}
            </button>
          )}
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

      <div className="view-layout">
        <DocumentPaper doc={doc} business={business} />

        <aside className="stack-sm no-print">
          {isInvoice && (
            <section className="card stack-sm">
              <h2>Payments</h2>
              {doc.payments.length === 0 && <p className="muted small">No payments recorded.</p>}
              {doc.payments.map((payment) => (
                <div key={payment.id} className="payment">
                  <div>
                    <div className="strong">{formatCents(payment.amountCents)}</div>
                    <div className="muted small">
                      {methodLabel(payment.method)} · {formatDate(payment.paidAt)}
                      {payment.note && ` · ${payment.note}`}
                    </div>
                  </div>
                  <button
                    className="link-button danger"
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
            </section>
          )}

          <section className="card stack-sm">
            <h2>More</h2>
            {doc.state !== 'draft' && editable && (
              <button className="button block" onClick={() => setModal('share')}>
                Copy customer link
              </button>
            )}
            {doc.kind === 'estimate' && doc.state !== 'converted' && (
              <button
                className="button block primary"
                onClick={() =>
                  run(async () => {
                    const invoice = await post<DocumentDetail>(`/documents/${doc.id}/convert`);
                    navigate(`/invoices/${invoice.id}`);
                  })
                }
              >
                Convert to invoice
              </button>
            )}
            {doc.kind === 'estimate' && doc.state === 'sent' && (
              <div className="row">
                <button
                  className="button"
                  onClick={() => run(() => post<DocumentDetail>(`/documents/${doc.id}/state`, { state: 'accepted' }))}
                >
                  Mark accepted
                </button>
                <button
                  className="button"
                  onClick={() => run(() => post<DocumentDetail>(`/documents/${doc.id}/state`, { state: 'declined' }))}
                >
                  Mark declined
                </button>
              </div>
            )}
            <button
              className="button block"
              onClick={() =>
                run(async () => {
                  const copy = await post<DocumentDetail>(`/documents/${doc.id}/duplicate`);
                  navigate(`/${copy.kind}s/${copy.id}/edit`);
                })
              }
            >
              Duplicate
            </button>
            {isInvoice && doc.state === 'sent' && (
              <button
                className="button block danger"
                onClick={() =>
                  confirm(`Void ${doc.number}? It will stay in your records but can't be paid or edited.`) &&
                  run(() => post<DocumentDetail>(`/documents/${doc.id}/state`, { state: 'void' }))
                }
              >
                Void invoice
              </button>
            )}
            {doc.state === 'draft' && (
              <button
                className="button block danger"
                onClick={() =>
                  confirm(`Delete draft ${doc.number}?`) &&
                  run(async () => {
                    await del(`/documents/${doc.id}`);
                    navigate(`/${doc.kind}s`);
                  })
                }
              >
                Delete draft
              </button>
            )}
          </section>
        </aside>
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
