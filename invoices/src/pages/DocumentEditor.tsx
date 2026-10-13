import { useEffect, useMemo, useState } from 'react';
import { addDays, computeTotals, formatCents, localDate, type DiscountType } from '../../shared/totals.ts';
import type {
  BusinessSettings,
  CatalogItem,
  Customer,
  DocumentDetail,
  DocumentKind,
  LineItem,
} from '../../shared/types.ts';
import { get, post, put } from '../api.ts';
import { Field, MoneyInput, bpsFromPercent, percentFromBps } from '../components.tsx';
import { navigate } from '../router.ts';
import { CustomerForm } from './Customers.tsx';

interface Draft {
  customerId: number | null;
  title: string;
  serviceAddress: string;
  issueDate: string;
  dueDate: string | null;
  notes: string;
  terms: string;
  discountType: DiscountType;
  discountValue: number;
  taxRateBps: number;
  lines: LineItem[];
}

const blankLine = (): LineItem => ({
  name: '',
  description: '',
  quantity: 1,
  unit: '',
  unitPriceCents: 0,
  taxable: true,
});

export function DocumentEditor({ kind, id }: { kind: DocumentKind; id: number | null }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [existing, setExisting] = useState<DocumentDetail | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [taxText, setTaxText] = useState('0');
  const [discountPercentText, setDiscountPercentText] = useState('0');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [settings, customerList, itemList, doc] = await Promise.all([
          get<BusinessSettings>('/settings'),
          get<Customer[]>('/customers'),
          get<CatalogItem[]>('/items'),
          id ? get<DocumentDetail>(`/documents/${id}`) : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setCustomers(customerList);
        setItems(itemList);
        setExisting(doc);

        const today = localDate();
        const initial: Draft = doc
          ? {
              customerId: doc.customerId,
              title: doc.title,
              serviceAddress: doc.serviceAddress,
              issueDate: doc.issueDate,
              dueDate: doc.dueDate,
              notes: doc.notes,
              terms: doc.terms,
              discountType: doc.discountType,
              discountValue: doc.discountValue,
              taxRateBps: doc.taxRateBps,
              lines: doc.lines,
            }
          : {
              customerId: null,
              title: '',
              serviceAddress: '',
              issueDate: today,
              dueDate: addDays(today, kind === 'invoice' ? settings.defaultDueDays : 30),
              notes: settings.defaultNotes,
              terms: settings.defaultTerms,
              discountType: 'none',
              discountValue: 0,
              taxRateBps: settings.defaultTaxRateBps,
              lines: [blankLine()],
            };

        setDraft(initial);
        setTaxText(percentFromBps(initial.taxRateBps));
        setDiscountPercentText(initial.discountType === 'percent' ? percentFromBps(initial.discountValue) : '0');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  const totals = useMemo(() => (draft ? computeTotals(draft) : null), [draft]);

  if (!draft || !totals) {
    return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  }

  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const updateLine = (index: number, patch: Partial<LineItem>) =>
    update({ lines: draft.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) });
  const moveLine = (index: number, delta: number) => {
    const lines = [...draft.lines];
    const [line] = lines.splice(index, 1);
    lines.splice(index + delta, 0, line);
    update({ lines });
  };
  const addFromCatalog = (itemId: string) => {
    const item = items.find((i) => String(i.id) === itemId);

    if (!item) {
      return;
    }

    const line: LineItem = {
      name: item.name,
      description: item.description,
      quantity: 1,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      taxable: item.taxable,
    };

    // Replace the untouched starter line instead of leaving it empty.
    const onlyBlank = draft.lines.length === 1 && !draft.lines[0].name && draft.lines[0].unitPriceCents === 0;
    update({ lines: onlyBlank ? [line] : [...draft.lines, line] });
  };

  const save = async () => {
    setError(null);

    if (draft.lines.some((line) => !line.name.trim())) {
      setError('Every line item needs a name.');
      return;
    }

    setSaving(true);

    try {
      const saved = existing
        ? await put<DocumentDetail>(`/documents/${existing.id}`, draft)
        : await post<DocumentDetail>('/documents', { ...draft, kind });
      navigate(`/${kind}s/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === draft.customerId);
  const label = kind === 'invoice' ? 'invoice' : 'estimate';

  return (
    <div className="stack">
      <div className="page-header">
        <h1>
          {existing ? `Edit ${existing.number}` : `New ${label}`}
          {existing && existing.state !== 'draft' && <span className="muted small"> (already sent)</span>}
        </h1>
        <div className="actions">
          <button className="button" onClick={() => history.back()}>
            Cancel
          </button>
          <button className="button primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="card grid-2">
        <div className="stack-sm">
          <Field label="Customer">
            <div className="row">
              <select
                value={draft.customerId ?? ''}
                onChange={(e) => {
                  const customerId = e.target.value ? Number(e.target.value) : null;
                  const customer = customers.find((c) => c.id === customerId);
                  update({
                    customerId,
                    serviceAddress: draft.serviceAddress || customer?.address || '',
                  });
                }}
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.name} (${c.company})` : c.name}
                  </option>
                ))}
              </select>
              <button className="button" type="button" onClick={() => setAddingCustomer(true)}>
                New
              </button>
            </div>
          </Field>
          {selectedCustomer && (
            <div className="muted small pre">
              {[selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(' · ')}
            </div>
          )}
          <Field label="Service address" hint="Where the work was done, if different from the billing address">
            <textarea
              rows={2}
              value={draft.serviceAddress}
              onChange={(e) => update({ serviceAddress: e.target.value })}
            />
          </Field>
        </div>
        <div className="stack-sm">
          <Field label="Title">
            <input
              value={draft.title}
              placeholder="e.g. Crawlspace mold remediation"
              onChange={(e) => update({ title: e.target.value })}
            />
          </Field>
          <div className="row">
            <Field label="Issue date">
              <input type="date" value={draft.issueDate} onChange={(e) => update({ issueDate: e.target.value })} />
            </Field>
            <Field label={kind === 'invoice' ? 'Due date' : 'Valid until'}>
              <input
                type="date"
                value={draft.dueDate ?? ''}
                onChange={(e) => update({ dueDate: e.target.value || null })}
              />
            </Field>
          </div>
          <div className="quick-due">
            {kind === 'invoice' &&
              [
                ['On receipt', 0],
                ['Net 7', 7],
                ['Net 15', 15],
                ['Net 30', 30],
              ].map(([text, days]) => (
                <button
                  key={text}
                  type="button"
                  className="chip"
                  onClick={() => update({ dueDate: addDays(draft.issueDate, Number(days)) })}
                >
                  {text}
                </button>
              ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Line items</h2>
          <span className="muted small">
            {draft.lines.length} item{draft.lines.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="lines">
          {draft.lines.map((line, index) => (
            <div className="line" key={index}>
              <div className="line-main">
                <input
                  aria-label="Item name"
                  placeholder="Item or service"
                  value={line.name}
                  onChange={(e) => updateLine(index, { name: e.target.value })}
                />
                <textarea
                  aria-label="Description"
                  placeholder="Description (optional)"
                  rows={2}
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                />
              </div>
              <div className="line-nums">
                <Field label="Qty">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </Field>
                <Field label="Unit">
                  <input
                    placeholder="sq ft"
                    value={line.unit}
                    onChange={(e) => updateLine(index, { unit: e.target.value })}
                  />
                </Field>
                <Field label="Price">
                  <MoneyInput
                    valueCents={line.unitPriceCents}
                    onChange={(unitPriceCents) => updateLine(index, { unitPriceCents })}
                  />
                </Field>
                <div className="line-amount">{formatCents(totals.lineTotalsCents[index])}</div>
              </div>
              <div className="line-tools">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={line.taxable}
                    onChange={(e) => updateLine(index, { taxable: e.target.checked })}
                  />
                  Taxable
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => moveLine(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Move down"
                  disabled={index === draft.lines.length - 1}
                  onClick={() => moveLine(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label="Remove line"
                  onClick={() => update({ lines: draft.lines.filter((_, i) => i !== index) })}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="row wrap">
          <button className="button" type="button" onClick={() => update({ lines: [...draft.lines, blankLine()] })}>
            + Add line
          </button>
          {items.length > 0 && (
            <select value="" onChange={(e) => addFromCatalog(e.target.value)} aria-label="Add from catalog">
              <option value="">+ Add from catalog…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {formatCents(item.unitPriceCents)}
                  {item.unit ? `/${item.unit}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      <section className="card grid-2">
        <div className="stack-sm">
          <Field label="Notes to customer">
            <textarea rows={3} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} />
          </Field>
          <Field label="Terms">
            <textarea rows={3} value={draft.terms} onChange={(e) => update({ terms: e.target.value })} />
          </Field>
        </div>
        <div className="stack-sm">
          <div className="row">
            <Field label="Discount">
              <select
                value={draft.discountType}
                onChange={(e) => {
                  setDiscountPercentText('0');
                  update({ discountType: e.target.value as DiscountType, discountValue: 0 });
                }}
              >
                <option value="none">None</option>
                <option value="percent">Percent</option>
                <option value="amount">Amount</option>
              </select>
            </Field>
            {draft.discountType === 'percent' && (
              <Field label="Percent">
                <input
                  inputMode="decimal"
                  value={discountPercentText}
                  onChange={(e) => {
                    setDiscountPercentText(e.target.value);
                    const value = bpsFromPercent(e.target.value);

                    if (value !== null) {
                      update({ discountValue: value });
                    }
                  }}
                />
              </Field>
            )}
            {draft.discountType === 'amount' && (
              <Field label="Amount">
                <MoneyInput valueCents={draft.discountValue} onChange={(discountValue) => update({ discountValue })} />
              </Field>
            )}
            <Field label="Tax rate %">
              <input
                inputMode="decimal"
                value={taxText}
                onChange={(e) => {
                  setTaxText(e.target.value);
                  const value = bpsFromPercent(e.target.value);

                  if (value !== null) {
                    update({ taxRateBps: value });
                  }
                }}
              />
            </Field>
          </div>
          <table className="summary">
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="num">{formatCents(totals.subtotalCents)}</td>
              </tr>
              {totals.discountCents > 0 && (
                <tr>
                  <td>Discount</td>
                  <td className="num">−{formatCents(totals.discountCents)}</td>
                </tr>
              )}
              <tr>
                <td>Tax</td>
                <td className="num">{formatCents(totals.taxCents)}</td>
              </tr>
              <tr className="total-row">
                <td>Total</td>
                <td className="num">{formatCents(totals.totalCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {addingCustomer && (
        <div className="modal-backdrop" onClick={() => setAddingCustomer(false)}>
          <div className="modal" role="dialog" aria-label="New customer" onClick={(e) => e.stopPropagation()}>
            <h2>New customer</h2>
            <CustomerForm
              onCancel={() => setAddingCustomer(false)}
              onSaved={(customer) => {
                setCustomers([...customers, customer].sort((a, b) => a.name.localeCompare(b.name)));
                update({ customerId: customer.id, serviceAddress: draft.serviceAddress || customer.address });
                setAddingCustomer(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
