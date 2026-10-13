import { useEffect, useState } from 'react';
import type { BusinessSettings } from '../../shared/types.ts';
import { put } from '../api.ts';
import { Field, bpsFromPercent, percentFromBps } from '../components.tsx';
import { useFetch } from '../hooks.ts';
import { resizeImage } from '../images.ts';

export function Settings() {
  const { data, error } = useFetch<BusinessSettings>('/settings');
  const [form, setForm] = useState<BusinessSettings | null>(null);
  const [taxText, setTaxText] = useState('0');
  const [status, setStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm(data);
      setTaxText(percentFromBps(data.defaultTaxRateBps));
    }
  }, [data]);

  if (!form) {
    return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  }

  const text = (key: keyof BusinessSettings) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setStatus(null);
      setForm({ ...form, [key]: e.target.value });
    },
  });

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaveError(null);

        const taxRate = bpsFromPercent(taxText);

        if (taxRate === null) {
          setSaveError('Tax rate must be a number between 0 and 100.');
          return;
        }

        try {
          setForm(await put<BusinessSettings>('/settings', { ...form, defaultTaxRateBps: taxRate }));
          setStatus('Saved');
        } catch (err) {
          setSaveError(err instanceof Error ? err.message : String(err));
        }
      }}
    >
      <div className="page-header">
        <h1>Settings</h1>
        <div className="actions">
          {status && <span className="muted">{status}</span>}
          <button type="submit" className="button primary">
            Save settings
          </button>
        </div>
      </div>
      {saveError && <p className="error">{saveError}</p>}

      <section className="card stack-sm">
        <h2>Business details</h2>
        <p className="muted small">Shown at the top of every invoice and estimate.</p>
        <div className="row">
          <Field label="Business name">
            <input {...text('name')} />
          </Field>
          <Field label="License number">
            <input {...text('license')} />
          </Field>
        </div>
        <div className="row">
          <Field label="Email">
            <input type="email" {...text('email')} />
          </Field>
          <Field label="Phone">
            <input type="tel" {...text('phone')} />
          </Field>
          <Field label="Website">
            <input {...text('website')} />
          </Field>
        </div>
        <Field label="Address">
          <textarea rows={2} {...text('address')} />
        </Field>
      </section>

      <section className="card stack-sm">
        <h2>Branding</h2>
        <p className="muted small">Your logo and color appear on invoices, estimates and the customer's page.</p>
        <div className="brand-row">
          <div className="logo-preview">
            {form.logoDataUrl ? <img src={form.logoDataUrl} alt="Logo" /> : <span className="muted small">No logo</span>}
          </div>
          <div className="stack-sm">
            <div className="row wrap">
              <label className="button file-button">
                {form.logoDataUrl ? 'Replace logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';

                    if (!file) {
                      return;
                    }

                    try {
                      setSaveError(null);
                      const image = await resizeImage(file, 600, 'image/png');
                      setStatus(null);
                      setForm({ ...form, logoDataUrl: image.dataUrl });
                    } catch (err) {
                      setSaveError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                />
              </label>
              {form.logoDataUrl && (
                <button type="button" className="button" onClick={() => setForm({ ...form, logoDataUrl: '' })}>
                  Remove
                </button>
              )}
            </div>
            <Field label="Brand color">
              <div className="row color-row">
                <input
                  type="color"
                  aria-label="Pick brand color"
                  value={form.brandColor}
                  onChange={(e) => {
                    setStatus(null);
                    setForm({ ...form, brandColor: e.target.value.toUpperCase() });
                  }}
                />
                <input {...text('brandColor')} aria-label="Brand color hex value" />
              </div>
            </Field>
          </div>
        </div>
      </section>

      <section className="card stack-sm">
        <h2>Invoice defaults</h2>
        <div className="row">
          <Field label="Default tax rate %">
            <input
              inputMode="decimal"
              value={taxText}
              onChange={(e) => {
                setStatus(null);
                setTaxText(e.target.value);
              }}
            />
          </Field>
          <Field label="Payment due (days)">
            <input
              type="number"
              min="0"
              max="365"
              value={form.defaultDueDays}
              onChange={(e) => setForm({ ...form, defaultDueDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })}
            />
          </Field>
          <Field label="Invoice prefix">
            <input {...text('invoicePrefix')} />
          </Field>
          <Field label="Estimate prefix">
            <input {...text('estimatePrefix')} />
          </Field>
        </div>
        <Field label="How customers can pay" hint="e.g. checks payable to…, Zelle, or a payment link. Shown on unpaid invoices.">
          <textarea rows={3} {...text('paymentInstructions')} />
        </Field>
        <Field label="Default notes">
          <textarea rows={2} {...text('defaultNotes')} />
        </Field>
        <Field label="Default terms">
          <textarea rows={3} {...text('defaultTerms')} />
        </Field>
      </section>
    </form>
  );
}
