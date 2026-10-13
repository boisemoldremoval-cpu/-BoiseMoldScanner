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
          ) : (
            <div>
              <div className="muted small">Amount due</div>
              <div className="public-amount">{formatCents(doc.balanceCents)}</div>
            </div>
          )
        ) : doc.status === 'sent' ? (
          <div className="public-estimate">
            <div>
              <div className="muted small">Estimate total</div>
              <div className="public-amount">{formatCents(doc.totalCents)}</div>
            </div>
            <div className="public-actions">
              <button className="button primary" onClick={() => respond('accepted')}>
                Accept estimate
              </button>
              <button className="button" onClick={() => respond('declined')}>
                Decline
              </button>
            </div>
          </div>
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
