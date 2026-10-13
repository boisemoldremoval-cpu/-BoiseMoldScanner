import { useMemo, useState } from 'react';
import { formatCents } from '../../shared/totals.ts';
import type { Dashboard as DashboardData, DocumentKind, DocumentSummary } from '../../shared/types.ts';
import { StatusBadge, formatShortDate } from '../components.tsx';
import { useFetch } from '../hooks.ts';
import { navigate } from '../router.ts';

export function Dashboard() {
  const { data, error } = useFetch<DashboardData>('/dashboard');

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!data) {
    return <p className="muted">Loading…</p>;
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Overview</h1>
        <div className="actions">
          <a className="button" href="#/estimates/new">
            New estimate
          </a>
          <a className="button primary" href="#/invoices/new">
            New invoice
          </a>
        </div>
      </div>

      <div className="stats">
        <Stat label="Outstanding" value={formatCents(data.outstandingCents)} />
        <Stat
          label="Overdue"
          value={formatCents(data.overdueCents)}
          detail={`${data.overdueCount} invoice${data.overdueCount === 1 ? '' : 's'}`}
          tone={data.overdueCount > 0 ? 'danger' : undefined}
        />
        <Stat label="Paid, last 30 days" value={formatCents(data.paidLast30Cents)} />
        <Stat label="Open estimates" value={formatCents(data.openEstimateCents)} />
      </div>

      <section className="card flush">
        <div className="card-header pad-x">
          <h2>Recent activity</h2>
          <a href="#/invoices" className="small">
            View all invoices
          </a>
        </div>
        {data.recent.length === 0 ? (
          <Empty />
        ) : (
          <DocumentTable rows={data.recent} />
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: 'danger' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}

function Empty() {
  return (
    <div className="empty">
      <p>No invoices or estimates yet.</p>
      <p className="muted">
        Start by adding your business details in <a href="#/settings">Settings</a>, then create an invoice.
      </p>
    </div>
  );
}

const FILTERS: Record<DocumentKind, { key: string; label: string; statuses: string[] | null }[]> = {
  invoice: [
    { key: 'all', label: 'All', statuses: null },
    { key: 'open', label: 'Outstanding', statuses: ['unpaid', 'partial', 'overdue'] },
    { key: 'overdue', label: 'Overdue', statuses: ['overdue'] },
    { key: 'paid', label: 'Paid', statuses: ['paid'] },
    { key: 'draft', label: 'Drafts', statuses: ['draft'] },
  ],
  estimate: [
    { key: 'all', label: 'All', statuses: null },
    { key: 'sent', label: 'Awaiting response', statuses: ['sent'] },
    { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
    { key: 'draft', label: 'Drafts', statuses: ['draft'] },
  ],
};

export function DocumentList({ kind }: { kind: DocumentKind }) {
  const { data, error } = useFetch<DocumentSummary[]>(`/documents?kind=${kind}`);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const filters = FILTERS[kind];

  const rows = useMemo(() => {
    const statuses = filters.find((f) => f.key === filter)?.statuses;
    const q = query.trim().toLowerCase();

    return (data ?? []).filter(
      (row) =>
        (!statuses || statuses.includes(row.status)) &&
        (!q || [row.number, row.customerName, row.title].some((value) => value.toLowerCase().includes(q))),
    );
  }, [data, filter, filters, query]);

  const plural = kind === 'invoice' ? 'Invoices' : 'Estimates';

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{plural}</h1>
        <a className="button primary" href={`#/${kind}s/new`}>
          New {kind}
        </a>
      </div>
      <div className="toolbar">
        <div className="tabs" role="tablist">
          {filters.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={filter === f.key ? 'tab active' : 'tab'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search number, customer or title"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <section className="card flush">
        {error && <p className="error">{error}</p>}
        {!data && !error && <p className="muted pad">Loading…</p>}
        {data && rows.length === 0 && <p className="muted pad">Nothing here yet.</p>}
        {rows.length > 0 && <DocumentTable rows={rows} />}
      </section>
    </div>
  );
}

function DocumentTable({ rows }: { rows: DocumentSummary[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Number</th>
          <th className="hide-sm">Customer</th>
          <th className="hide-sm">Due</th>
          <th className="hide-sm">Status</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const owing = row.kind === 'invoice' && row.balanceCents > 0 && row.balanceCents < row.totalCents;

          return (
            <tr key={`${row.kind}-${row.id}`} className="clickable" onClick={() => navigate(`/${row.kind}s/${row.id}`)}>
              <td>
                <a href={`#/${row.kind}s/${row.id}`} className="strong" onClick={(e) => e.stopPropagation()}>
                  {row.number}
                </a>
                {row.title && <div className="muted small truncate hide-sm">{row.title}</div>}
                {row.customerName && <div className="muted small truncate show-sm">{row.customerName}</div>}
              </td>
              <td className="truncate hide-sm">{row.customerName || <span className="muted">—</span>}</td>
              <td className="hide-sm nowrap">{formatShortDate(row.dueDate)}</td>
              <td className="hide-sm">
                <StatusBadge status={row.status} />
              </td>
              <td className="num nowrap">
                <div className="strong">{formatCents(row.totalCents)}</div>
                {owing && <div className="muted small hide-sm">{formatCents(row.balanceCents)} due</div>}
                <div className="show-sm">
                  <StatusBadge status={row.status} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
