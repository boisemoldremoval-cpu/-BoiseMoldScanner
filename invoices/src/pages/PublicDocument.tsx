import { useEffect, useState } from 'react';
import { formatCents } from '../../shared/totals.ts';
import type { PublicDocument as PublicDocumentData } from '../../shared/types.ts';
import { get, post } from '../api.ts';
import { DocumentPaper } from '../components.tsx';
import { IS_DEMO } from '../env.ts';

// What the customer sees when they open the link from an email or text.
export function PublicDocument({ token }: { token: string }) {
  const [data, setData] = useState<PublicDocumentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState('');
  const [respondError, setRespondError] = useState<string | null>(null);

  useEffect(() => {
    // The owner's "Preview" link adds ?preview=1 so it doesn't count as a customer view.
    const preview = window.location.hash.includes('preview=1') ? '?preview=1' : '';
    get<PublicDocumentData>(`/public/${encodeURIComponent(token)}${preview}`)
      .then(setData)
      .catch(() => setError('This link is invalid or no longer available.'));
  }, [token]);

  useEffect(() => {
    if (data) {
      const kind = data.document.kind === 'invoice' ? 'Invoice' : 'Estimate';
      document.title = `${kind} ${data.document.number}${data.business.name ? ` · ${data.business.name}` : ''}`;
    }
  }, [data]);

  if (error) {
    return (
      <main className="public">
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="public">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const { document: doc, business } = data;
  const respond = async (response: 'accepted' | 'declined') => {
    setRespondError(null);

    try {
      setData(
        await post<PublicDocumentData>(`/public/${encodeURIComponent(token)}/respond`, {
          response,
          ...(response === 'accepted' ? { name: signature } : {}),
        }),
      );
      setSigning(false);
    } catch (e) {
      setRespondError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="public stack">
      {IS_DEMO && (
        <div className="demo-banner">
          <span>
            <strong>Demo.</strong> This is the page your customer sees from their link.
          </span>
          <a href={`#/${doc.kind}s/${doc.id}`}>← Back to the app</a>
        </div>
      )}
      <div className="public-bar no-print">
        {doc.kind === 'invoice' ? (
          doc.status === 'paid' ? (
            <strong>Paid in full. Thank you!</strong>
          ) : doc.status === 'void' ? (
            <strong>This invoice has been voided.</strong>
          ) : doc.depositDueCents > 0 ? (
            <div className="public-amounts">
              <div>
                <div className="muted small">Deposit due now</div>
                <div className="public-amount">{formatCents(doc.depositDueCents)}</div>
              </div>
              <div>
                <div className="muted small">Total balance</div>
                <div className="public-amount secondary">{formatCents(doc.balanceCents)}</div>
              </div>
            </div>
          ) : (
            <div>
              <div className="muted small">Amount due</div>
              <div className="public-amount">{formatCents(doc.balanceCents)}</div>
            </div>
          )
        ) : doc.status === 'sent' ? (
          signing ? (
            <form
              className="sign-form"
              onSubmit={(e) => {
                e.preventDefault();
                void respond('accepted');
              }}
            >
              <label className="field">
                <span className="field-label">Type your full name to accept this estimate</span>
                <input
                  id="signature"
                  autoFocus
                  autoComplete="name"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </label>
              {signature.trim() && <div className="signature-name">{signature}</div>}
              <p className="muted small">
                By accepting, you agree to the work and price in this estimate
                {doc.depositCents > 0 ? `, including a ${formatCents(doc.depositCents)} deposit` : ''}.
              </p>
              {respondError && <p className="error small">{respondError}</p>}
              <div className="public-actions">
                <button type="submit" className="button primary" disabled={signature.trim().length < 2}>
                  Accept and sign
                </button>
                <button type="button" className="button" onClick={() => setSigning(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="public-estimate">
              <div>
                <div className="muted small">Estimate total</div>
                <div className="public-amount">{formatCents(doc.totalCents)}</div>
                {doc.depositCents > 0 && (
                  <div className="muted small">{formatCents(doc.depositCents)} deposit to start</div>
                )}
              </div>
              <div className="public-actions">
                <button className="button primary" onClick={() => setSigning(true)}>
                  Accept estimate
                </button>
                <button className="button" onClick={() => respond('declined')}>
                  Decline
                </button>
              </div>
            </div>
          )
        ) : (
          <strong>
            {doc.status === 'accepted' || doc.status === 'converted'
              ? 'Estimate accepted. Thank you!'
              : 'This estimate was declined.'}
          </strong>
        )}
        {!IS_DEMO && (
          <button className="button" onClick={() => window.print()}>
            Download / Print
          </button>
        )}
      </div>
      <DocumentPaper doc={doc} business={business} />
    </main>
  );
}
