/*
 * In-browser stand-in for the server API, used only by the demo build
 * (`pnpm build:demo`). It mirrors server/db.ts and server/app.ts closely
 * enough to click through every screen, and keeps data in localStorage.
 */
import { addDays, computeTotals, depositCents, deriveStatus, formatCents, localDate } from '../../shared/totals.ts';
import type {
  Attachment,
  BusinessSettings,
  CatalogItem,
  Customer,
  Dashboard,
  DocumentDetail,
  DocumentKind,
  DocumentEvent,
  DocumentSummary,
  EventType,
  LineItem,
  Payment,
} from '../../shared/types.ts';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface StoredDocument {
  id: number;
  kind: DocumentKind;
  number: string;
  state: string;
  customerId: number | null;
  title: string;
  serviceAddress: string;
  issueDate: string;
  dueDate: string | null;
  notes: string;
  terms: string;
  discountType: 'none' | 'percent' | 'amount';
  discountValue: number;
  taxRateBps: number;
  depositType: 'none' | 'percent' | 'amount';
  depositValue: number;
  viewedAt: string | null;
  viewCount: number;
  acceptedName: string;
  acceptedAt: string | null;
  events: DocumentEvent[];
  attachments: Attachment[];
  publicToken: string;
  sentAt: string | null;
  convertedToId: number | null;
  sourceEstimateId: number | null;
  createdAt: string;
  updatedAt: string;
  lines: LineItem[];
  payments: Payment[];
}

interface DemoData {
  nextId: number;
  settings: BusinessSettings;
  customers: Customer[];
  items: CatalogItem[];
  documents: StoredDocument[];
}

const STORAGE_KEY = 'invoices-demo-v2';

function load(): DemoData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      return JSON.parse(raw) as DemoData;
    }
  } catch {
    // Storage can be unavailable (private windows, previews); fall back to fresh sample data.
  }

  return seed();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // The demo still works for this visit without storage.
  }
}

export function resetDemo() {
  data = seed();
  save();
}

const conflict = (message: string) => new ApiError(409, message);
const notFound = (message = 'Not found') => new ApiError(404, message);
const nowIso = () => new Date().toISOString();
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36)).join('').slice(0, 24);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function nextNumber(kind: DocumentKind) {
  const prefix = kind === 'invoice' ? data.settings.invoicePrefix : data.settings.estimatePrefix;
  const max = Math.max(
    0,
    ...data.documents.filter((d) => d.kind === kind).map((d) => Number(/(\d+)$/.exec(d.number)?.[1] ?? 0)),
  );

  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function logEvent(doc: StoredDocument, type: EventType, detail = '') {
  doc.events.push({ id: data.nextId++, type, at: nowIso(), detail });
}

function hydrate(doc: StoredDocument, today = localDate()): DocumentDetail {
  const customer = data.customers.find((c) => c.id === doc.customerId) ?? null;
  const totals = computeTotals(doc);
  const paidCents = sum(doc.payments.map((p) => p.amountCents));
  const deposit = depositCents(doc.depositType, doc.depositValue, totals.totalCents);

  return {
    ...doc,
    events: doc.events.map((e) => ({ ...e })),
    attachments: doc.attachments.map((a) => ({ ...a })),
    depositCents: deposit,
    depositDueCents: doc.state === 'void' ? 0 : Math.max(0, deposit - paidCents),
    lines: doc.lines.map((line) => ({ ...line })),
    payments: [...doc.payments].sort((a, b) => (a.paidAt < b.paidAt ? -1 : 1)),
    customer,
    customerName: customer ? customer.company || customer.name : '',
    status: deriveStatus({ kind: doc.kind, state: doc.state, dueDate: doc.dueDate, totalCents: totals.totalCents, paidCents, today }),
    totals,
    totalCents: totals.totalCents,
    paidCents,
    balanceCents: doc.state === 'void' ? 0 : Math.max(0, totals.totalCents - paidCents),
  };
}

function summarize(d: DocumentDetail): DocumentSummary {
  const { id, kind, number, title, customerId, customerName, issueDate, dueDate, status, totalCents, paidCents, balanceCents, viewedAt } = d;

  return { id, kind, number, title, customerId, customerName, issueDate, dueDate, status, totalCents, paidCents, balanceCents, viewedAt };
}

function findDoc(id: number) {
  const doc = data.documents.find((d) => d.id === id);

  if (!doc) {
    throw notFound();
  }

  return doc;
}

type DocInput = Pick<
  StoredDocument,
  | 'customerId'
  | 'title'
  | 'serviceAddress'
  | 'issueDate'
  | 'dueDate'
  | 'notes'
  | 'terms'
  | 'discountType'
  | 'discountValue'
  | 'taxRateBps'
  | 'depositType'
  | 'depositValue'
  | 'lines'
>;

function validateDoc(input: DocInput) {
  if (input.lines.some((l) => !l.name.trim())) {
    throw new ApiError(400, 'Every line needs a name');
  }

  if (input.dueDate && input.dueDate < input.issueDate) {
    throw new ApiError(400, 'Due date cannot be before the issue date');
  }

  if (input.discountType === 'percent' && input.discountValue > 10000) {
    throw new ApiError(400, 'Discount cannot exceed 100%');
  }

  if (input.depositType === 'percent' && input.depositValue > 10000) {
    throw new ApiError(400, 'Deposit cannot exceed 100%');
  }
}

function createDoc(kind: DocumentKind, input: DocInput, sourceEstimateId: number | null = null): StoredDocument {
  validateDoc(input);

  const doc: StoredDocument = {
    ...pickDocInput(input),
    id: data.nextId++,
    kind,
    number: nextNumber(kind),
    state: 'draft',
    publicToken: token(),
    sentAt: null,
    convertedToId: null,
    sourceEstimateId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    payments: [],
    viewedAt: null,
    viewCount: 0,
    acceptedName: '',
    acceptedAt: null,
    events: [],
    attachments: [],
  };

  data.documents.push(doc);
  logEvent(doc, 'created');

  return doc;
}

function pickDocInput(input: DocInput): DocInput {
  return {
    customerId: input.customerId,
    title: input.title ?? '',
    serviceAddress: input.serviceAddress ?? '',
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    notes: input.notes ?? '',
    terms: input.terms ?? '',
    discountType: input.discountType,
    discountValue: input.discountValue,
    taxRateBps: input.taxRateBps,
    depositType: input.depositType ?? 'none',
    depositValue: input.depositValue ?? 0,
    lines: input.lines.map(({ name, description, quantity, unit, unitPriceCents, taxable }) => ({
      name,
      description,
      quantity,
      unit,
      unitPriceCents,
      taxable,
    })),
  };
}

function setState(doc: StoredDocument, state: string, acceptedName = '') {
  const allowed: Record<string, string[]> = { invoice: ['sent', 'void'], estimate: ['sent', 'accepted', 'declined'] };

  if (!allowed[doc.kind].includes(state)) {
    throw conflict(`Cannot mark this ${doc.kind} as ${state}`);
  }

  if (doc.state === 'void' || doc.state === 'converted') {
    throw conflict(`This ${doc.kind} is ${doc.state} and can no longer change`);
  }

  if (state === 'void' && doc.payments.length > 0) {
    throw conflict('Remove recorded payments before voiding this invoice');
  }

  if (doc.state === state) {
    return;
  }

  doc.state = state;
  doc.sentAt = state === 'sent' ? (doc.sentAt ?? nowIso()) : doc.sentAt;
  doc.acceptedName = state === 'accepted' ? acceptedName : '';
  doc.acceptedAt = state === 'accepted' ? nowIso() : null;
  doc.updatedAt = nowIso();

  const eventType: Record<string, EventType> = { sent: 'sent', void: 'voided', accepted: 'accepted', declined: 'declined' };
  logEvent(doc, eventType[state], state === 'accepted' && acceptedName ? `Signed by ${acceptedName}` : '');
}

function dashboard(): Dashboard {
  const today = localDate();
  const invoices = data.documents.filter((d) => d.kind === 'invoice').map((d) => hydrate(d, today));
  const estimates = data.documents.filter((d) => d.kind === 'estimate').map((d) => hydrate(d, today));
  const since = addDays(today, -30);
  const open = invoices.filter((d) => ['unpaid', 'partial', 'overdue'].includes(d.status));
  const overdue = invoices.filter((d) => d.status === 'overdue');

  return {
    outstandingCents: sum(open.map((d) => d.balanceCents)),
    overdueCents: sum(overdue.map((d) => d.balanceCents)),
    overdueCount: overdue.length,
    paidLast30Cents: sum(
      invoices.filter((d) => d.state !== 'void').flatMap((d) => d.payments.filter((p) => p.paidAt >= since).map((p) => p.amountCents)),
    ),
    draftCount: invoices.filter((d) => d.status === 'draft').length,
    openEstimateCents: sum(estimates.filter((d) => d.status === 'sent').map((d) => d.totalCents)),
    recent: [...invoices, ...estimates]
      .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : b.id - a.id))
      .slice(0, 8)
      .map(summarize),
  };
}

function route(method: string, path: string, body: any): unknown {
  const [pathname, query = ''] = path.split('?');
  const parts = pathname.split('/').filter(Boolean);
  const id = Number(parts[1]);

  const handle = (): unknown => {
    switch (`${method} ${parts[0]}${parts.length > 1 ? '/:id' : ''}${parts[2] ? `/${parts[2]}` : ''}${parts[3] ? '/:sub' : ''}`) {
      case 'POST demo/:id':
        data = seed();
        return { ok: true };
      case 'GET session':
        return { authRequired: false, authenticated: true };
      case 'GET settings':
        return data.settings;
      case 'PUT settings':
        data.settings = { ...data.settings, ...body };
        return data.settings;
      case 'GET dashboard':
        return dashboard();

      case 'GET customers/:id': {
        const customer = data.customers.find((c) => c.id === id);

        if (!customer) {
          throw notFound('Customer not found');
        }

        return customer;
      }
      case 'GET customers':
        return [...data.customers].sort((a, b) => a.name.localeCompare(b.name));
      case 'POST customers': {
        if (!body.name?.trim()) {
          throw new ApiError(400, 'Name is required');
        }

        const customer: Customer = { ...body, id: data.nextId++, createdAt: nowIso() };
        data.customers.push(customer);
        return customer;
      }
      case 'PUT customers/:id': {
        const customer = data.customers.find((c) => c.id === id);

        if (!customer) {
          throw notFound('Customer not found');
        }

        Object.assign(customer, body);
        return customer;
      }
      case 'DELETE customers/:id':
        if (data.documents.some((d) => d.customerId === id)) {
          throw conflict('This customer has invoices or estimates and cannot be deleted');
        }

        data.customers = data.customers.filter((c) => c.id !== id);
        return undefined;

      case 'GET items':
        return [...data.items].sort((a, b) => a.name.localeCompare(b.name));
      case 'POST items': {
        const item: CatalogItem = { ...body, id: data.nextId++ };
        data.items.push(item);
        return item;
      }
      case 'PUT items/:id': {
        const item = data.items.find((i) => i.id === id);

        if (!item) {
          throw notFound('Item not found');
        }

        Object.assign(item, body);
        return item;
      }
      case 'DELETE items/:id':
        data.items = data.items.filter((i) => i.id !== id);
        return undefined;

      case 'GET documents': {
        const kind = new URLSearchParams(query).get('kind');
        return data.documents
          .filter((d) => d.kind === kind)
          .map((d) => summarize(hydrate(d)))
          .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : b.id - a.id));
      }
      case 'POST documents':
        return hydrate(createDoc(body.kind, body));
      case 'GET documents/:id':
        return hydrate(findDoc(id));
      case 'PUT documents/:id': {
        const doc = findDoc(id);

        if (doc.state === 'void' || doc.state === 'converted') {
          throw conflict(`This ${doc.kind} can no longer be edited`);
        }

        validateDoc(body);
        Object.assign(doc, pickDocInput(body), { updatedAt: nowIso() });
        return hydrate(doc);
      }
      case 'DELETE documents/:id': {
        const doc = findDoc(id);

        if (doc.state !== 'draft') {
          throw conflict('Only drafts can be deleted. Void the invoice instead.');
        }

        data.documents = data.documents.filter((d) => d.id !== id);
        return undefined;
      }
      case 'POST documents/:id/state': {
        const doc = findDoc(id);
        setState(doc, body.state);
        return hydrate(doc);
      }
      case 'POST documents/:id/convert': {
        const estimate = findDoc(id);

        if (estimate.kind !== 'estimate' || estimate.state === 'converted') {
          throw conflict('This estimate was already converted');
        }

        const issueDate = localDate();
        const invoice = createDoc(
          'invoice',
          { ...estimate, issueDate, dueDate: addDays(issueDate, data.settings.defaultDueDays) },
          estimate.id,
        );
        estimate.state = 'converted';
        estimate.convertedToId = invoice.id;
        invoice.attachments = estimate.attachments.map((a) => ({ ...a, id: data.nextId++ }));
        logEvent(estimate, 'converted', `Invoice ${invoice.number}`);
        logEvent(invoice, 'converted', `From estimate ${estimate.number}`);
        return hydrate(invoice);
      }
      case 'POST documents/:id/duplicate': {
        const source = findDoc(id);
        const issueDate = localDate();
        return hydrate(
          createDoc(source.kind, {
            ...source,
            issueDate,
            dueDate: source.kind === 'invoice' ? addDays(issueDate, data.settings.defaultDueDays) : source.dueDate,
          }),
        );
      }
      case 'POST documents/:id/payments': {
        const doc = findDoc(id);
        const current = hydrate(doc);

        if (doc.kind !== 'invoice' || doc.state === 'void') {
          throw conflict('Payments can only be recorded on open invoices');
        }

        if (!(body.amountCents > 0)) {
          throw new ApiError(400, 'Amount must be greater than zero');
        }

        if (body.amountCents > current.balanceCents) {
          throw conflict('Payment is larger than the balance due');
        }

        doc.payments.push({ ...body, id: data.nextId++ });
        logEvent(doc, 'payment', `${formatCents(body.amountCents)} by ${body.method === 'bank_transfer' ? 'bank transfer' : body.method}`);

        if (doc.state === 'draft') {
          setState(doc, 'sent');
        }

        return hydrate(doc);
      }
      case 'DELETE documents/:id/payments/:sub': {
        const doc = findDoc(id);
        const payment = doc.payments.find((p) => p.id === Number(parts[3]));

        if (!payment) {
          throw notFound('Payment not found');
        }

        doc.payments = doc.payments.filter((p) => p !== payment);
        logEvent(doc, 'payment_removed', formatCents(payment.amountCents));
        return hydrate(doc);
      }
      case 'POST documents/:id/attachments': {
        const doc = findDoc(id);

        if (doc.attachments.length >= 12) {
          throw conflict('Up to 12 photos can be attached');
        }

        if (!/^data:image\/(jpeg|png|webp);base64,/.test(body.dataUrl ?? '')) {
          throw new ApiError(400, 'Photos must be JPEG, PNG or WebP');
        }

        doc.attachments.push({
          id: data.nextId++,
          filename: body.filename,
          caption: body.caption ?? '',
          width: body.width,
          height: body.height,
          url: body.dataUrl,
        });
        return hydrate(doc);
      }
      case 'PUT documents/:id/attachments/:sub':
      case 'DELETE documents/:id/attachments/:sub': {
        const doc = findDoc(id);
        const photo = doc.attachments.find((a) => a.id === Number(parts[3]));

        if (!photo) {
          throw notFound('Photo not found');
        }

        if (method === 'PUT') {
          photo.caption = body.caption ?? '';
        } else {
          doc.attachments = doc.attachments.filter((a) => a !== photo);
        }

        return hydrate(doc);
      }

      case 'GET public/:id':
      case 'POST public/:id/respond': {
        const doc = data.documents.find((d) => d.publicToken === parts[1]);

        if (!doc || doc.state === 'draft') {
          throw notFound();
        }

        if (method === 'POST') {
          if (doc.kind !== 'estimate' || doc.state !== 'sent') {
            throw conflict('This estimate is no longer awaiting a response');
          }

          if (body.response === 'accepted' && !(body.name?.trim().length >= 2)) {
            throw new ApiError(400, 'Type your full name to accept');
          }

          setState(doc, body.response, body.name?.trim() ?? '');
        } else if (new URLSearchParams(query).get('preview') !== '1') {
          doc.viewCount += 1;
          doc.viewedAt = doc.viewedAt ?? nowIso();

          if (!doc.events.some((e) => e.type === 'viewed')) {
            logEvent(doc, 'viewed', 'First view');
          }

          save();
        }

        const document = hydrate(doc);
        return {
          business: data.settings,
          document: { ...document, customer: document.customer ? { ...document.customer, notes: '' } : null, events: [] },
        };
      }
      default:
        throw notFound();
    }
  };

  const result = handle();

  if (method !== 'GET') {
    save();
  }

  // Return copies so screens can't mutate stored state by accident.
  return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 60));

  return route(method, path, body ?? {}) as T;
}

export const get = <T,>(path: string) => api<T>('GET', path);
export const post = <T,>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
export const put = <T,>(path: string, body: unknown) => api<T>('PUT', path, body);
export const del = <T,>(path: string) => api<T>('DELETE', path);

// Sample data so every screen has something to show. All names are fictional.
function seed(): DemoData {
  const today = localDate();
  const d = (offset: number) => addDays(today, offset);
  let nextId = 1;
  const settings: BusinessSettings = {
    name: 'Example Mold Co.',
    email: 'office@example.com',
    phone: '(208) 555-0100',
    address: '123 Main St\nBoise, ID 83702',
    website: 'example.com',
    license: 'RCE-00000',
    defaultTaxRateBps: 600,
    defaultDueDays: 14,
    defaultTerms: 'Payment due within 14 days. Work guaranteed for 12 months.',
    defaultNotes: 'Thank you for your business!',
    paymentInstructions: 'Checks payable to Example Mold Co.\nCard payments by phone: (208) 555-0100',
    invoicePrefix: 'INV-',
    estimatePrefix: 'EST-',
    logoDataUrl: '',
    brandColor: '#1F6F5C',
  };
  const items: CatalogItem[] = [
    ['Mold inspection', 'Visual inspection and moisture mapping', 17500, 'visit', false],
    ['Air quality test', 'Lab-analyzed spore sampling, per sample', 9500, 'sample', false],
    ['Mold remediation', 'Containment, HEPA vacuum, antimicrobial treatment', 450, 'sq ft', true],
    ['Dehumidifier rental', 'Commercial dehumidifier', 4500, 'day', true],
    ['Encapsulation', 'Crawlspace vapor barrier and sealant', 325, 'sq ft', true],
  ].map(([name, description, unitPriceCents, unit, taxable]) => ({
    id: nextId++,
    name: name as string,
    description: description as string,
    unitPriceCents: unitPriceCents as number,
    unit: unit as string,
    taxable: taxable as boolean,
  }));
  const customers: Customer[] = [
    ['Jane Example', '', 'jane@example.com', '(208) 555-0199', '45 Oak Ave\nMeridian, ID 83642'],
    ['Sam Sample', 'Sample Property Mgmt', 'sam@example.com', '(208) 555-0142', '900 W State St\nBoise, ID 83702'],
    ['Alex Placeholder', '', 'alex@example.com', '(208) 555-0177', '12 Pine Ln\nEagle, ID 83616'],
    ['Riley Demo', 'Demo Dental', 'riley@example.com', '(208) 555-0123', '77 Fairview Ave\nBoise, ID 83704'],
  ].map(([name, company, email, phone, address]) => ({
    id: nextId++,
    name,
    company,
    email,
    phone,
    address,
    notes: '',
    createdAt: nowIso(),
  }));
  const line = (name: string, quantity: number): LineItem => {
    const item = items.find((i) => i.name === name)!;
    return { name, description: item.description, quantity, unit: item.unit, unitPriceCents: item.unitPriceCents, taxable: item.taxable };
  };
  const counters = { invoice: 0, estimate: 0 };
  const documents: StoredDocument[] = [];
  const add = (
    kind: DocumentKind,
    customerIndex: number,
    title: string,
    issueOffset: number,
    dueDays: number,
    state: string,
    lines: LineItem[],
    payments: [number | 'full', string, number, string][] = [],
    extra: Partial<StoredDocument> = {},
  ) => {
    const doc: StoredDocument = {
      id: nextId++,
      kind,
      number: `${kind === 'invoice' ? 'INV-' : 'EST-'}${String(++counters[kind]).padStart(4, '0')}`,
      state,
      customerId: customers[customerIndex].id,
      title,
      serviceAddress: customers[customerIndex].address,
      issueDate: d(issueOffset),
      dueDate: d(issueOffset + dueDays),
      notes: settings.defaultNotes,
      terms: settings.defaultTerms,
      discountType: 'none',
      discountValue: 0,
      taxRateBps: 600,
      publicToken: token(),
      sentAt: state === 'draft' ? null : nowIso(),
      convertedToId: null,
      sourceEstimateId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      depositType: 'none',
      depositValue: 0,
      viewedAt: null,
      viewCount: 0,
      acceptedName: '',
      acceptedAt: null,
      events: [],
      attachments: [],
      lines,
      payments: [],
      ...extra,
    };
    const at = (offset: number, hour = 9) => `${d(offset)}T${String(hour).padStart(2, '0')}:15:00.000Z`;
    doc.events.push({ id: nextId++, type: 'created', at: at(issueOffset, 8), detail: '' });

    if (state !== 'draft') {
      doc.events.push({ id: nextId++, type: 'sent', at: at(issueOffset, 9), detail: '' });
    }

    if (extra.viewedAt) {
      doc.events.push({ id: nextId++, type: 'viewed', at: extra.viewedAt, detail: 'First view' });
    }

    if (state === 'accepted') {
      doc.acceptedAt = at(issueOffset + 1, 15);
      doc.events.push({ id: nextId++, type: 'accepted', at: doc.acceptedAt, detail: doc.acceptedName ? `Signed by ${doc.acceptedName}` : '' });
    }
    const total = computeTotals(doc).totalCents;
    doc.payments = payments.map(([amount, method, offset, note]) => ({
      id: nextId++,
      amountCents: amount === 'full' ? total : amount,
      method,
      paidAt: d(offset),
      note,
    }));

    for (const payment of doc.payments) {
      doc.events.push({
        id: nextId++,
        type: 'payment',
        at: `${payment.paidAt}T17:30:00.000Z`,
        detail: `${formatCents(payment.amountCents)} by ${payment.method}`,
      });
    }

    doc.events.sort((a, b) => (a.at < b.at ? -1 : 1));
    documents.push(doc);
  };

  add('invoice', 1, 'Unit 4B bathroom remediation', -54, 14, 'sent', [line('Mold inspection', 1), line('Mold remediation', 120), line('Air quality test', 2)], [
    ['full', 'check', -42, 'Check #2210'],
  ]);
  add('invoice', 2, 'Attic remediation', -33, 14, 'sent', [line('Mold remediation', 300), line('Dehumidifier rental', 3), line('Air quality test', 1)], [], {
    viewedAt: `${d(-31)}T16:05:00.000Z`,
    viewCount: 1,
  });
  add('invoice', 0, 'Crawlspace mold remediation', -7, 14, 'sent', [line('Mold remediation', 400), line('Encapsulation', 400), line('Air quality test', 2)], [
    [150000, 'card', -6, 'Deposit'],
  ], { discountType: 'percent', discountValue: 500, depositType: 'percent', depositValue: 5000, viewedAt: `${d(-7)}T19:42:00.000Z`, viewCount: 3 });
  add('invoice', 3, 'Front office inspection', -2, 14, 'sent', [line('Mold inspection', 1), line('Air quality test', 3)]);
  add('invoice', 1, 'Unit 7A follow-up test', 0, 14, 'draft', [line('Air quality test', 2)]);
  add('estimate', 3, 'Break room wall remediation', -1, 30, 'sent', [line('Mold remediation', 80), line('Dehumidifier rental', 2), line('Air quality test', 1)]);
  add('estimate', 2, 'Basement encapsulation', -4, 30, 'accepted', [line('Encapsulation', 650), line('Dehumidifier rental', 4)], [], {
    depositType: 'percent',
    depositValue: 3000,
    acceptedName: 'Alex Placeholder',
    viewedAt: `${d(-4)}T21:10:00.000Z`,
    viewCount: 2,
  });

  return { nextId, settings, customers, items, documents };
}

// Loaded last so every helper above is initialized before seeding runs.
let data: DemoData = load();
