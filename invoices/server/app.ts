import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { ConflictError, NotFoundError, Store } from './db.ts';

const SESSION_COOKIE = 'inv_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const text = (max: number) => z.string().trim().max(max).default('');
const cents = z.number().int().min(0).max(1_000_000_000_00);
const bps = z.number().int().min(0).max(10000);

const settingsSchema = z.object({
  name: text(200),
  email: text(200),
  phone: text(50),
  address: text(500),
  website: text(200),
  license: text(100),
  defaultTaxRateBps: bps,
  defaultDueDays: z.number().int().min(0).max(365),
  defaultTerms: text(4000),
  defaultNotes: text(4000),
  paymentInstructions: text(4000),
  invoicePrefix: text(20),
  estimatePrefix: text(20),
});

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  company: text(200),
  email: z.union([z.literal(''), z.string().trim().email('Invalid email').max(200)]).default(''),
  phone: text(50),
  address: text(500),
  notes: text(4000),
});

const itemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: text(2000),
  unitPriceCents: cents,
  unit: text(30),
  taxable: z.boolean().default(true),
});

const lineSchema = z.object({
  name: z.string().trim().min(1, 'Every line needs a name').max(200),
  description: text(2000),
  quantity: z.number().min(0).max(1_000_000),
  unit: text(30),
  unitPriceCents: cents,
  taxable: z.boolean().default(true),
});

const documentSchema = z
  .object({
    customerId: z.number().int().positive().nullable(),
    title: text(200),
    serviceAddress: text(500),
    issueDate: isoDate,
    dueDate: isoDate.nullable(),
    notes: text(4000),
    terms: text(4000),
    discountType: z.enum(['none', 'percent', 'amount']),
    discountValue: z.number().int().min(0),
    taxRateBps: bps,
    lines: z.array(lineSchema).max(200),
  })
  .refine((doc) => doc.discountType !== 'percent' || doc.discountValue <= 10000, {
    message: 'Discount cannot exceed 100%',
    path: ['discountValue'],
  })
  .refine((doc) => !doc.dueDate || doc.dueDate >= doc.issueDate, {
    message: 'Due date cannot be before the issue date',
    path: ['dueDate'],
  });

const paymentSchema = z.object({
  amountCents: z.number().int().min(1, 'Amount must be greater than zero'),
  method: z.enum(['cash', 'check', 'card', 'bank_transfer', 'other']),
  paidAt: isoDate,
  note: text(500),
});

const kindSchema = z.enum(['invoice', 'estimate']);

export interface AppOptions {
  store: Store;

  // When unset, the API is open, so the server must only listen on localhost.
  adminPassword?: string;
}

export function createApp({ store, adminPassword }: AppOptions) {
  const app = express();
  const sessions = new Map<string, number>();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const isAuthed = (req: Request) => {
    if (!adminPassword) {
      return true;
    }

    const token = readCookie(req, SESSION_COOKIE);
    const expires = token ? sessions.get(token) : undefined;

    return expires !== undefined && expires > Date.now();
  };

  // Public routes: the customer-facing invoice link and login.

  app.get('/api/session', (req, res) => {
    res.json({ authRequired: Boolean(adminPassword), authenticated: isAuthed(req) });
  });

  app.post('/api/login', (req, res) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!adminPassword || !safeEqual(password, adminPassword)) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    const token = randomBytes(32).toString('base64url');
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    res.setHeader('Set-Cookie', sessionCookie(req, token, SESSION_TTL_MS));
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    const token = readCookie(req, SESSION_COOKIE);

    if (token) {
      sessions.delete(token);
    }

    res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
    res.json({ ok: true });
  });

  app.get('/api/public/:token', (req, res) => {
    const document = store.getDocumentByToken(req.params.token);
    res.json({ business: store.getSettings(), document: stripInternal(document) });
  });

  app.post('/api/public/:token/respond', (req, res) => {
    const { response } = z.object({ response: z.enum(['accepted', 'declined']) }).parse(req.body);
    const document = store.getDocumentByToken(req.params.token);

    if (document.kind !== 'estimate' || document.state !== 'sent') {
      throw new ConflictError('This estimate is no longer awaiting a response');
    }

    store.setState(document.id, response);
    res.json({ business: store.getSettings(), document: stripInternal(store.getDocument(document.id)) });
  });

  // Everything below requires the owner to be signed in.

  app.use('/api', (req, res, next) => {
    if (!isAuthed(req)) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }

    next();
  });

  app.get('/api/settings', (_req, res) => {
    res.json(store.getSettings());
  });

  app.put('/api/settings', (req, res) => {
    res.json(store.saveSettings(settingsSchema.parse(req.body)));
  });

  app.get('/api/dashboard', (_req, res) => {
    res.json(store.dashboard());
  });

  app.get('/api/customers', (_req, res) => {
    res.json(store.listCustomers());
  });

  app.post('/api/customers', (req, res) => {
    res.status(201).json(store.createCustomer(customerSchema.parse(req.body)));
  });

  app.put('/api/customers/:id', (req, res) => {
    res.json(store.updateCustomer(id(req), customerSchema.parse(req.body)));
  });

  app.delete('/api/customers/:id', (req, res) => {
    store.deleteCustomer(id(req));
    res.status(204).end();
  });

  app.get('/api/items', (_req, res) => {
    res.json(store.listItems());
  });

  app.post('/api/items', (req, res) => {
    res.status(201).json(store.createItem(itemSchema.parse(req.body)));
  });

  app.put('/api/items/:id', (req, res) => {
    res.json(store.updateItem(id(req), itemSchema.parse(req.body)));
  });

  app.delete('/api/items/:id', (req, res) => {
    store.deleteItem(id(req));
    res.status(204).end();
  });

  app.get('/api/documents', (req, res) => {
    res.json(store.listDocuments(kindSchema.parse(req.query.kind)));
  });

  app.post('/api/documents', (req, res) => {
    const kind = kindSchema.parse(req.body?.kind);
    res.status(201).json(store.createDocument(kind, documentSchema.parse(req.body)));
  });

  app.get('/api/documents/:id', (req, res) => {
    res.json(store.getDocument(id(req)));
  });

  app.put('/api/documents/:id', (req, res) => {
    res.json(store.updateDocument(id(req), documentSchema.parse(req.body)));
  });

  app.delete('/api/documents/:id', (req, res) => {
    store.deleteDocument(id(req));
    res.status(204).end();
  });

  app.post('/api/documents/:id/state', (req, res) => {
    const { state } = z.object({ state: z.enum(['sent', 'void', 'accepted', 'declined']) }).parse(req.body);
    res.json(store.setState(id(req), state));
  });

  app.post('/api/documents/:id/convert', (req, res) => {
    res.status(201).json(store.convertEstimate(id(req)));
  });

  app.post('/api/documents/:id/duplicate', (req, res) => {
    res.status(201).json(store.duplicateDocument(id(req)));
  });

  app.post('/api/documents/:id/payments', (req, res) => {
    res.status(201).json(store.addPayment(id(req), paymentSchema.parse(req.body)));
  });

  app.delete('/api/documents/:id/payments/:paymentId', (req, res) => {
    const paymentId = z.coerce.number().int().positive().parse(req.params.paymentId);
    res.json(store.deletePayment(id(req), paymentId));
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      res.status(400).json({ error: issue.message, path: issue.path });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else if (error instanceof ConflictError) {
      res.status(409).json({ error: error.message });
    } else if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON' });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });

  return app;
}

function id(req: Request): number {
  return z.coerce.number().int().positive().parse(req.params.id);
}

// Customers see the document, not internal bookkeeping fields.
function stripInternal<T extends { customer: { notes: string } | null }>(document: T): T {
  return document.customer ? { ...document, customer: { ...document.customer, notes: '' } } : document;
}

function safeEqual(a: string, b: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest();

  return timingSafeEqual(hash(a), hash(b));
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');

    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return undefined;
}

function sessionCookie(req: Request, value: string, maxAgeMs: number): string {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';

  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`;
}
