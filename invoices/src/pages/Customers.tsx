import { useState } from 'react';
import type { Customer } from '../../shared/types.ts';
import { del, post, put } from '../api.ts';
import { Field } from '../components.tsx';
import { useFetch } from '../hooks.ts';

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
                <tr key={c.id}>
                  <td>
                    <div className="strong">{c.name}</div>
                    {c.company && <div className="muted small">{c.company}</div>}
                  </td>
                  <td>{c.email}</td>
                  <td className="hide-sm">{c.phone}</td>
                  <td className="num nowrap">
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
