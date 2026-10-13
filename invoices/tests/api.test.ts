import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
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

    const accepted = await call('POST', `/public/${token}/respond`, { response: 'accepted' });
    expect(accepted.body.document.status).toBe('accepted');
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
