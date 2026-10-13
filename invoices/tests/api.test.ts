import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../server/db.ts';

let server: Server;
let store: Store;
let base: string;
let cookie = '';

async function start(adminPassword?: string) {
  store = new Store(':memory:');
  server = createApp({ store, adminPassword }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  cookie = '';
}

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get('set-cookie');

  if (setCookie) {
    cookie = setCookie.split(';')[0];
  }

  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

const invoiceBody = (customerId: number | null, extra: Record<string, unknown> = {}) => ({
  kind: 'invoice',
  customerId,
  title: 'Crawlspace remediation',
  serviceAddress: '',
  issueDate: '2099-05-01',
  dueDate: '2099-05-15',
  notes: '',
  terms: '',
  discountType: 'none',
  discountValue: 0,
  taxRateBps: 600,
  lines: [
    { name: 'Remediation', description: '', quantity: 400, unit: 'sq ft', unitPriceCents: 450, taxable: true },
    { name: 'Air quality test', description: '', quantity: 1, unit: '', unitPriceCents: 25000, taxable: false },
  ],
  ...extra,
});

afterEach(() => {
  server?.close();
  store?.close();
  server = undefined as unknown as Server;
  store = undefined as unknown as Store;
});

describe('invoice lifecycle', () => {
  beforeEach(() => start());

  it('creates, sends, partially pays and fully pays an invoice', async () => {
    const customer = await call('POST', '/customers', { name: 'Jane Doe', email: 'jane@example.com' });
    expect(customer.status).toBe(201);

    const created = await call('POST', '/documents', invoiceBody(customer.body.id));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ number: 'INV-0001', status: 'draft', totalCents: 215800 });
    // 400 sq ft x $4.50 = $1,800 taxed at 6% ($108) + $250 untaxed.
    expect(created.body.totals.taxCents).toBe(10800);

    const id = created.body.id;
    expect((await call('POST', `/documents/${id}/state`, { state: 'sent' })).body.status).toBe('unpaid');

    const partial = await call('POST', `/documents/${id}/payments`, {
      amountCents: 100000,
      method: 'check',
      paidAt: '2099-05-03',
      note: '#1042',
    });
    expect(partial.body).toMatchObject({ status: 'partial', balanceCents: 115800 });

    const overpay = await call('POST', `/documents/${id}/payments`, {
      amountCents: 200000,
      method: 'cash',
      paidAt: '2099-05-04',
      note: '',
    });
    expect(overpay.status).toBe(409);

    const paid = await call('POST', `/documents/${id}/payments`, {
      amountCents: 115800,
      method: 'card',
      paidAt: '2099-05-04',
      note: '',
    });
    expect(paid.body).toMatchObject({ status: 'paid', balanceCents: 0 });

    // Paid invoices cannot be voided until their payments are removed.
    expect((await call('POST', `/documents/${id}/state`, { state: 'void' })).status).toBe(409);
  });

  it('numbers invoices sequentially and estimates separately', async () => {
    await call('POST', '/documents', invoiceBody(null));
    const second = await call('POST', '/documents', invoiceBody(null));
    const estimate = await call('POST', '/documents', { ...invoiceBody(null), kind: 'estimate' });

    expect(second.body.number).toBe('INV-0002');
    expect(estimate.body.number).toBe('EST-0001');
  });

  it('converts an estimate into an invoice once', async () => {
    const estimate = await call('POST', '/documents', { ...invoiceBody(null), kind: 'estimate' });
    const invoice = await call('POST', `/documents/${estimate.body.id}/convert`);

    expect(invoice.status).toBe(201);
    expect(invoice.body).toMatchObject({ kind: 'invoice', sourceEstimateId: estimate.body.id, totalCents: 215800 });
    expect((await call('GET', `/documents/${estimate.body.id}`)).body).toMatchObject({
      status: 'converted',
      convertedToId: invoice.body.id,
    });
    expect((await call('POST', `/documents/${estimate.body.id}/convert`)).status).toBe(409);
  });

  it('only deletes drafts and keeps void invoices read-only', async () => {
    const draft = await call('POST', '/documents', invoiceBody(null));
    const sent = await call('POST', '/documents', invoiceBody(null));
    await call('POST', `/documents/${sent.body.id}/state`, { state: 'sent' });

    expect((await call('DELETE', `/documents/${sent.body.id}`)).status).toBe(409);
    expect((await call('DELETE', `/documents/${draft.body.id}`)).status).toBe(204);

    await call('POST', `/documents/${sent.body.id}/state`, { state: 'void' });
    expect((await call('PUT', `/documents/${sent.body.id}`, invoiceBody(null))).status).toBe(409);
    expect((await call('GET', '/dashboard')).body.outstandingCents).toBe(0);
  });

  it('rejects invalid input', async () => {
    expect((await call('POST', '/documents', invoiceBody(null, { dueDate: '2099-04-01' }))).status).toBe(400);
    expect(
      (await call('POST', '/documents', invoiceBody(null, { discountType: 'percent', discountValue: 20000 }))).status,
    ).toBe(400);
    expect((await call('POST', '/customers', { name: '' })).status).toBe(400);
    expect((await call('GET', '/documents/abc')).status).toBe(400);
    expect((await call('GET', '/documents/999')).status).toBe(404);
  });

  it('refuses to delete a customer who has invoices', async () => {
    const customer = await call('POST', '/customers', { name: 'Bob' });
    await call('POST', '/documents', invoiceBody(customer.body.id));

    expect((await call('DELETE', `/customers/${customer.body.id}`)).status).toBe(409);
  });
});

describe('customer link', () => {
  beforeEach(() => start());

  it('hides drafts and private customer notes', async () => {
    const customer = await call('POST', '/customers', { name: 'Jane', notes: 'Gate code 1234' });
    const doc = await call('POST', '/documents', invoiceBody(customer.body.id));
    const token = doc.body.publicToken;

    expect((await call('GET', `/public/${token}`)).status).toBe(404);

    await call('POST', `/documents/${doc.body.id}/state`, { state: 'sent' });
    const visible = await call('GET', `/public/${token}`);

    expect(visible.status).toBe(200);
    expect(visible.body.document.customer.notes).toBe('');
    expect((await call('GET', '/public/not-a-real-token')).status).toBe(404);
  });

  it('lets the customer accept an estimate once', async () => {
    const estimate = await call('POST', '/documents', { ...invoiceBody(null), kind: 'estimate' });
    await call('POST', `/documents/${estimate.body.id}/state`, { state: 'sent' });
    const token = estimate.body.publicToken;

    expect((await call('POST', `/public/${token}/respond`, { response: 'accepted' })).status).toBe(400);
    expect((await call('POST', `/public/${token}/respond`, { response: 'accepted', name: ' ' })).status).toBe(400);

    const accepted = await call('POST', `/public/${token}/respond`, { response: 'accepted', name: 'Jane Doe' });
    expect(accepted.body.document).toMatchObject({ status: 'accepted', acceptedName: 'Jane Doe' });
    expect(accepted.body.document.acceptedAt).toBeTruthy();
    expect((await call('POST', `/public/${token}/respond`, { response: 'declined' })).status).toBe(409);
  });
});

describe('password protection', () => {
  beforeEach(() => start('correct horse'));

  it('requires sign-in for owner routes but not for customer links', async () => {
    expect((await call('GET', '/dashboard')).status).toBe(401);
    expect((await call('GET', '/session')).body).toEqual({ authRequired: true, authenticated: false });
    expect((await call('POST', '/login', { password: 'wrong' })).status).toBe(401);

    expect((await call('POST', '/login', { password: 'correct horse' })).status).toBe(200);
    expect(cookie).toMatch(/^inv_session=/);

    const doc = await call('POST', '/documents', invoiceBody(null));
    await call('POST', `/documents/${doc.body.id}/state`, { state: 'sent' });

    await call('POST', '/logout');
    expect((await call('GET', '/dashboard')).status).toBe(401);
    expect((await call('GET', `/public/${doc.body.publicToken}`)).status).toBe(200);
  });
});

// A 1x1 transparent PNG.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('deposits', () => {
  beforeEach(() => start());

  it('tracks how much of a requested deposit is still due', async () => {
    const doc = await call('POST', '/documents', invoiceBody(null, { depositType: 'percent', depositValue: 5000 }));
    // Half of $2,158.00.
    expect(doc.body).toMatchObject({ depositCents: 107900, depositDueCents: 107900 });

    await call('POST', `/documents/${doc.body.id}/state`, { state: 'sent' });
    const paid = await call('POST', `/documents/${doc.body.id}/payments`, {
      amountCents: 50000,
      method: 'card',
      paidAt: '2099-05-02',
      note: '',
    });
    expect(paid.body.depositDueCents).toBe(57900);

    expect((await call('POST', '/documents', invoiceBody(null, { depositType: 'percent', depositValue: 20000 }))).status).toBe(400);
  });

  it('carries the deposit from an estimate to its invoice', async () => {
    const estimate = await call('POST', '/documents', {
      ...invoiceBody(null),
      kind: 'estimate',
      depositType: 'amount',
      depositValue: 50000,
    });
    const invoice = await call('POST', `/documents/${estimate.body.id}/convert`);

    expect(invoice.body).toMatchObject({ depositType: 'amount', depositCents: 50000 });
  });
});

describe('activity and views', () => {
  beforeEach(() => start());

  it('records customer views but not owner previews', async () => {
    const doc = await call('POST', '/documents', invoiceBody(null));
    await call('POST', `/documents/${doc.body.id}/state`, { state: 'sent' });
    const token = doc.body.publicToken;

    await call('GET', `/public/${token}?preview=1`);
    expect((await call('GET', `/documents/${doc.body.id}`)).body).toMatchObject({ viewCount: 0, viewedAt: null });

    await call('GET', `/public/${token}`);
    await call('GET', `/public/${token}`);
    const viewed = (await call('GET', `/documents/${doc.body.id}`)).body;

    expect(viewed.viewCount).toBe(2);
    expect(viewed.viewedAt).toBeTruthy();
    // Repeat views on the same day are counted but logged once.
    expect(viewed.events.map((e: { type: string }) => e.type)).toEqual(['created', 'sent', 'viewed']);
    expect((await call('GET', '/documents?kind=invoice')).body[0].viewedAt).toBeTruthy();
  });

  it('logs payments and keeps the log away from customers', async () => {
    const doc = await call('POST', '/documents', invoiceBody(null));
    await call('POST', `/documents/${doc.body.id}/state`, { state: 'sent' });
    const paid = await call('POST', `/documents/${doc.body.id}/payments`, {
      amountCents: 10000,
      method: 'bank_transfer',
      paidAt: '2099-05-02',
      note: '',
    });

    expect(paid.body.events.at(-1)).toMatchObject({ type: 'payment', detail: '$100.00 by bank transfer' });
    expect((await call('GET', `/public/${doc.body.publicToken}`)).body.document.events).toEqual([]);
  });
});

describe('photos', () => {
  beforeEach(() => start());

  it('attaches photos and serves them to customers only through their link', async () => {
    const doc = await call('POST', '/documents', invoiceBody(null));
    const added = await call('POST', `/documents/${doc.body.id}/attachments`, {
      filename: 'before.png',
      caption: 'Before',
      width: 1,
      height: 1,
      dataUrl: `data:image/png;base64,${PNG}`,
    });
    expect(added.status).toBe(201);

    const photo = added.body.attachments[0];
    const image = await fetch(base.replace('/api', '') + photo.url);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await image.arrayBuffer()).toString('base64')).toBe(PNG);

    // Drafts aren't public, so neither are their photos.
    const token = doc.body.publicToken;
    expect((await fetch(`${base}/public/${token}/attachments/${photo.id}`)).status).toBe(404);

    await call('POST', `/documents/${doc.body.id}/state`, { state: 'sent' });
    const publicDoc = (await call('GET', `/public/${token}`)).body.document;
    expect(publicDoc.attachments[0].url).toBe(`/api/public/${token}/attachments/${photo.id}`);
    expect((await fetch(base.replace('/api', '') + publicDoc.attachments[0].url)).status).toBe(200);

    const estimate = await call('POST', '/documents', { ...invoiceBody(null), kind: 'estimate' });
    await call('POST', `/documents/${estimate.body.id}/attachments`, {
      filename: 'job.png',
      caption: 'Crawlspace',
      width: 1,
      height: 1,
      dataUrl: `data:image/png;base64,${PNG}`,
    });
    const converted = await call('POST', `/documents/${estimate.body.id}/convert`);
    expect(converted.body.attachments).toMatchObject([{ caption: 'Crawlspace', filename: 'job.png' }]);

    const captioned = await call('PUT', `/documents/${doc.body.id}/attachments/${photo.id}`, { caption: 'After' });
    expect(captioned.body.attachments[0].caption).toBe('After');
    expect((await call('DELETE', `/documents/${doc.body.id}/attachments/${photo.id}`)).body.attachments).toEqual([]);
  });

  it('rejects files that are not images', async () => {
    const doc = await call('POST', '/documents', invoiceBody(null));
    const bad = await call('POST', `/documents/${doc.body.id}/attachments`, {
      filename: 'x.html',
      caption: '',
      width: 1,
      height: 1,
      dataUrl: 'data:text/html;base64,PGgxPmhpPC9oMT4=',
    });

    expect(bad.status).toBe(400);
  });
});

describe('settings and exports', () => {
  beforeEach(() => start());

  it('validates the logo and brand color', async () => {
    const settings = (await call('GET', '/settings')).body;

    expect((await call('PUT', '/settings', { ...settings, brandColor: 'red' })).status).toBe(400);
    expect((await call('PUT', '/settings', { ...settings, logoDataUrl: 'javascript:alert(1)' })).status).toBe(400);

    const saved = await call('PUT', '/settings', { ...settings, brandColor: '#123ABC', logoDataUrl: `data:image/png;base64,${PNG}` });
    expect(saved.body).toMatchObject({ brandColor: '#123ABC' });
  });

  it('exports invoices and payments as CSV', async () => {
    const customer = await call('POST', '/customers', { name: '=HYPERLINK("x")', company: 'Smith, Jones & Co' });
    const doc = await call('POST', '/documents', invoiceBody(customer.body.id));
    await call('POST', `/documents/${doc.body.id}/state`, { state: 'sent' });
    await call('POST', `/documents/${doc.body.id}/payments`, { amountCents: 15800, method: 'check', paidAt: '2099-05-03', note: '#77' });

    const invoices = await (await fetch(`${base}/export/invoices.csv`)).text();
    expect(invoices.split('\r\n')[0]).toBe('Number,Customer,Title,Issued,Due,Status,Subtotal,Discount,Tax,Total,Paid,Balance');
    expect(invoices).toContain('INV-0001,"Smith, Jones & Co",Crawlspace remediation,2099-05-01,2099-05-15,partial,2050.00,0.00,108.00,2158.00,158.00,2000.00');

    const payments = await (await fetch(`${base}/export/payments.csv`)).text();
    expect(payments).toContain('2099-05-03,INV-0001,"Smith, Jones & Co",check,158.00,#77');
  });

  it('neutralizes spreadsheet formulas in exported text', async () => {
    const customer = await call('POST', '/customers', { name: '=HYPERLINK("x")' });
    await call('POST', '/documents', invoiceBody(customer.body.id));

    expect(await (await fetch(`${base}/export/invoices.csv`)).text()).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('upgrading an existing database', () => {
  it('adds the new columns to a database created before them', async () => {
    const dir = await import('node:os').then((os) => os.tmpdir());
    const path = `${dir}/invoices-migrate-${Date.now()}.db`;
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE documents (
      id INTEGER PRIMARY KEY, kind TEXT NOT NULL, number TEXT NOT NULL, state TEXT NOT NULL, customer_id INTEGER,
      title TEXT NOT NULL DEFAULT '', service_address TEXT NOT NULL DEFAULT '', issue_date TEXT NOT NULL, due_date TEXT,
      notes TEXT NOT NULL DEFAULT '', terms TEXT NOT NULL DEFAULT '', discount_type TEXT NOT NULL DEFAULT 'none',
      discount_value INTEGER NOT NULL DEFAULT 0, tax_rate_bps INTEGER NOT NULL DEFAULT 0, public_token TEXT NOT NULL UNIQUE,
      sent_at TEXT, converted_to_id INTEGER, source_estimate_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO documents (kind, number, state, issue_date, public_token) VALUES ('invoice', 'INV-0001', 'sent', '2099-01-01', 'tok');`);
    old.close();

    const upgraded = new Store(path);
    expect(upgraded.getDocument(1)).toMatchObject({ number: 'INV-0001', depositType: 'none', viewCount: 0, events: [] });
    upgraded.close();
  });
});
