import { useState } from 'react';
import type { Customer } from '../../shared/types.ts';
import { del, post, put } from '../api.ts';
import { Field } from '../components.tsx';
import { useFetch } from '../hooks.ts';
import { navigate } from '../router.ts';
import { formatCents } from '../../shared/totals.ts';
import type { DocumentSummary } from '../../shared/types.ts';
import { DocumentTable } from './lists.tsx';

type CustomerInput = Omit<Customer, 'id' | 'createdAt'>;

const emptyCustomer: CustomerInput = { name: '', company: '', email: '', phone: '', address: '', notes: '' };

export function CustomerForm({
  customer,
  onSaved,
  onCancel,
}: {
  customer?: Customer;
  onSaved: (customer: Customer) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CustomerInput>(customer ?? emptyCustomer);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof CustomerInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className="stack-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
          const { name, company, email, phone, address, notes } = form;
          const body = { name, company, email, phone, address, notes };
          onSaved(customer ? await put(`/customers/${customer.id}`, body) : await post('/customers', body));
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      {error && <p className="error">{error}</p>}
      <div className="row">
        <Field label="Name">
          <input required autoFocus value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Company">
          <input value={form.company} onChange={set('company')} />
        </Field>
      </div>
      <div className="row">
        <Field label="Email">
          <input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={form.phone} onChange={set('phone')} />
        </Field>
      </div>
      <Field label="Billing address">
        <textarea rows={2} value={form.address} onChange={set('address')} />
      </Field>
      <Field label="Private notes" hint="Only you see these">
        <textarea rows={2} value={form.notes} onChange={set('notes')} />
      </Field>
      <div className="actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save customer'}
        </button>
      </div>
    </form>
  );
}

export function Customers() {
  const { data, error, reload } = useFetch<Customer[]>('/customers');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (c) => !q || [c.name, c.company, c.email, c.phone].some((v) => v.toLowerCase().includes(q)),
  );

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Customers</h1>
        <button className="button primary" onClick={() => setEditing('new')}>
          New customer
        </button>
      </div>
      <input type="search" placeholder="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} />
      {(error || actionError) && <p className="error">{error ?? actionError}</p>}
      <section className="card flush">
        {data && rows.length === 0 && <p className="muted pad">No customers yet.</p>}
        {rows.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th className="hide-sm">Phone</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td>
                    <a href={`#/customers/${c.id}`} className="strong" onClick={(e) => e.stopPropagation()}>
                      {c.name}
                    </a>
                    {c.company && <div className="muted small">{c.company}</div>}
                  </td>
                  <td>{c.email}</td>
                  <td className="hide-sm">{c.phone}</td>
                  <td className="num nowrap" onClick={(e) => e.stopPropagation()}>
                    <button className="link-button" onClick={() => setEditing(c)}>
                      Edit
                    </button>
                    <button
                      className="link-button danger"
                      onClick={async () => {
                        if (!confirm(`Delete ${c.name}?`)) {
                          return;
                        }

                        try {
                          setActionError(null);
                          await del(`/customers/${c.id}`);
                          await reload();
                        } catch (e) {
                          setActionError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" role="dialog" aria-label="Customer" onClick={(e) => e.stopPropagation()}>
            <h2>{editing === 'new' ? 'New customer' : 'Edit customer'}</h2>
            <CustomerForm
              customer={editing === 'new' ? undefined : editing}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await reload();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerDetail({ id }: { id: number }) {
  const { data: customer, setData: setCustomer, error } = useFetch<Customer>(`/customers/${id}`);
  const { data: invoices } = useFetch<DocumentSummary[]>('/documents?kind=invoice');
  const { data: estimates } = useFetch<DocumentSummary[]>('/documents?kind=estimate');
  const [editing, setEditing] = useState(false);

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!customer || !invoices || !estimates) {
    return <p className="muted">Loading…</p>;
  }

  const theirs = [...invoices, ...estimates]
    .filter((doc) => doc.customerId === id)
    .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : b.id - a.id));
  const billed = theirs.filter((d) => d.kind === 'invoice' && d.status !== 'void' && d.status !== 'draft');
  const sumOf = (values: number[]) => values.reduce((a, b) => a + b, 0);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <a href="#/customers" className="back-link">
            ← Customers
          </a>
          <h1>{customer.name}</h1>
          {customer.company && <div className="muted">{customer.company}</div>}
        </div>
        <div className="actions">
          <button className="button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <a className="button" href={`#/estimates/new?customer=${id}`}>
            New estimate
          </a>
          <a className="button primary" href={`#/invoices/new?customer=${id}`}>
            New invoice
          </a>
        </div>
      </div>

      <div className="stats three">
        <div className="stat">
          <div className="stat-label">Billed</div>
          <div className="stat-value">{formatCents(sumOf(billed.map((d) => d.totalCents)))}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Paid</div>
          <div className="stat-value">{formatCents(sumOf(billed.map((d) => d.paidCents)))}</div>
        </div>
        <div className={`stat ${billed.some((d) => d.status === 'overdue') ? 'danger' : ''}`}>
          <div className="stat-label">Owes</div>
          <div className="stat-value">{formatCents(sumOf(billed.map((d) => d.balanceCents)))}</div>
        </div>
      </div>

      <div className="view-layout">
        <section className="card flush">
          <div className="card-header pad-x">
            <h2>Invoices and estimates</h2>
          </div>
          {theirs.length === 0 ? <p className="muted pad">Nothing yet.</p> : <DocumentTable rows={theirs} showCustomer={false} />}
        </section>
        <aside className="card stack-sm">
          <h2>Contact</h2>
          {customer.email && <a href={`mailto:${customer.email}`}>{customer.email}</a>}
          {customer.phone && <a href={`tel:${customer.phone}`}>{customer.phone}</a>}
          {customer.address && <div className="pre">{customer.address}</div>}
          {customer.notes && (
            <div>
              <div className="field-label">Private notes</div>
              <div className="pre small">{customer.notes}</div>
            </div>
          )}
        </aside>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <div className="modal" role="dialog" aria-label="Edit customer" onClick={(e) => e.stopPropagation()}>
            <h2>Edit customer</h2>
            <CustomerForm
              customer={customer}
              onCancel={() => setEditing(false)}
              onSaved={(saved) => {
                setCustomer(saved);
                setEditing(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
