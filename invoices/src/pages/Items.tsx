import { useState } from 'react';
import { formatCents } from '../../shared/totals.ts';
import type { CatalogItem } from '../../shared/types.ts';
import { del, post, put } from '../api.ts';
import { Field, MoneyInput } from '../components.tsx';
import { useFetch } from '../hooks.ts';

type ItemInput = Omit<CatalogItem, 'id'>;

const emptyItem: ItemInput = { name: '', description: '', unitPriceCents: 0, unit: '', taxable: true };

export function Items() {
  const { data, error, reload } = useFetch<CatalogItem[]>('/items');
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Services &amp; items</h1>
          <p className="muted">Save the services you bill often so you can add them to an invoice in one click.</p>
        </div>
        <button className="button primary" onClick={() => setEditing('new')}>
          New item
        </button>
      </div>
      {(error || actionError) && <p className="error">{error ?? actionError}</p>}
      <section className="card flush">
        {data && data.length === 0 && <p className="muted pad">No saved items yet.</p>}
        {data && data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Price</th>
                <th className="hide-sm">Taxable</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="strong">{item.name}</div>
                    {item.description && <div className="muted small">{item.description}</div>}
                  </td>
                  <td className="num">
                    {formatCents(item.unitPriceCents)}
                    {item.unit && <span className="muted">/{item.unit}</span>}
                  </td>
                  <td className="hide-sm">{item.taxable ? 'Yes' : 'No'}</td>
                  <td className="num nowrap">
                    <button className="link-button" onClick={() => setEditing(item)}>
                      Edit
                    </button>
                    <button
                      className="link-button danger"
                      onClick={async () => {
                        if (!confirm(`Delete ${item.name}?`)) {
                          return;
                        }

                        try {
                          setActionError(null);
                          await del(`/items/${item.id}`);
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
          <div className="modal" role="dialog" aria-label="Item" onClick={(e) => e.stopPropagation()}>
            <h2>{editing === 'new' ? 'New item' : 'Edit item'}</h2>
            <ItemForm
              item={editing === 'new' ? undefined : editing}
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

function ItemForm({ item, onSaved, onCancel }: { item?: CatalogItem; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<ItemInput>(item ?? emptyItem);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="stack-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
          const { name, description, unitPriceCents, unit, taxable } = form;
          const body = { name, description, unitPriceCents, unit, taxable };
          await (item ? put(`/items/${item.id}`, body) : post('/items', body));
          onSaved();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      {error && <p className="error">{error}</p>}
      <Field label="Name">
        <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Description">
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <div className="row">
        <Field label="Price">
          <MoneyInput valueCents={form.unitPriceCents} onChange={(unitPriceCents) => setForm({ ...form, unitPriceCents })} />
        </Field>
        <Field label="Unit" hint="e.g. hour, sq ft, visit">
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} />
        Taxable
      </label>
      <div className="actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save item'}
        </button>
      </div>
    </form>
  );
}
