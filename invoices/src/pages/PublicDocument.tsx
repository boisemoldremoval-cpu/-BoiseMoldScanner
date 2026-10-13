import { useEffect, useState } from 'react';
import { formatCents } from '../../shared/totals.ts';
import type { PublicDocument as PublicDocumentData } from '../../shared/types.ts';
import { get, post } from '../api.ts';
import { DocumentPaper } from '../components.tsx';

// What the customer sees when they open the link from an email or text.
export function PublicDocument({ token }: { token: string }) {
  const [data, setData] = useState<PublicDocumentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<PublicDocumentData>(`/public/${encodeURIComponent(token)}`)
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
    try {
      setData(await post<PublicDocumentData>(`/public/${encodeURIComponent(token)}/respond`, { response }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="public stack">
      <div className="public-bar no-print">
        {doc.kind === 'invoice' ? (
          doc.status === 'paid' ? (
            <strong>Paid in full. Thank you!</strong>
          ) : doc.status === 'void' ? (
            <strong>This invoice has been voided.</strong>
          ) : (
            <div>
              <div className="muted small">Amount due</div>
              <div className="public-amount">{formatCents(doc.balanceCents)}</div>
            </div>
          )
        ) : doc.status === 'sent' ? (
          <div className="row wrap">
            <span>Would you like to go ahead with this estimate?</span>
            <button className="button primary" onClick={() => respond('accepted')}>
              Accept estimate
            </button>
            <button className="button" onClick={() => respond('declined')}>
              Decline
            </button>
          </div>
        ) : (
          <strong>
            {doc.status === 'accepted' || doc.status === 'converted'
              ? 'Estimate accepted. Thank you!'
              : 'This estimate was declined.'}
          </strong>
        )}
        <button className="button" onClick={() => window.print()}>
          Download / Print
        </button>
      </div>
      <DocumentPaper doc={doc} business={business} />
    </main>
  );
}
