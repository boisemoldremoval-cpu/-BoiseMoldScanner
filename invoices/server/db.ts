import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { addDays, computeTotals, deriveStatus, localDate, type DiscountType } from '../shared/totals.ts';
import type {
  BusinessSettings,
  CatalogItem,
  Customer,
  Dashboard,
  DocumentDetail,
  DocumentKind,
  DocumentSummary,
  LineItem,
  Payment,
} from '../shared/types.ts';

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  taxable INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('invoice', 'estimate')),
  number TEXT NOT NULL,
  state TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  service_address TEXT NOT NULL DEFAULT '',
  issue_date TEXT NOT NULL,
  due_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  terms TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT 'none',
  discount_value INTEGER NOT NULL DEFAULT 0,
  tax_rate_bps INTEGER NOT NULL DEFAULT 0,
  public_token TEXT NOT NULL UNIQUE,
  sent_at TEXT,
  converted_to_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  source_estimate_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, number)
);

CREATE TABLE IF NOT EXISTS line_items (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER NOT NULL,
  taxable INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_line_items_document ON line_items(document_id, position);
CREATE INDEX IF NOT EXISTS idx_payments_document ON payments(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_kind ON documents(kind, issue_date);
`;

export const DEFAULT_SETTINGS: BusinessSettings = {
  name: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  license: '',
  defaultTaxRateBps: 0,
  defaultDueDays: 14,
  defaultTerms: '',
  defaultNotes: 'Thank you for your business!',
  paymentInstructions: '',
  invoicePrefix: 'INV-',
  estimatePrefix: 'EST-',
};

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

type Row = Record<string, any>;

export interface DocumentInput {
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

export type CustomerInput = Omit<Customer, 'id' | 'createdAt'>;
export type ItemInput = Omit<CatalogItem, 'id'>;
export type PaymentInput = Omit<Payment, 'id'>;

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  private transactionDepth = 0;

  // Nested calls join the outer transaction because SQLite has no nested BEGIN.
  private transaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) {
      return fn();
    }

    this.db.exec('BEGIN');
    this.transactionDepth++;

    try {
      const result = fn();
      this.db.exec('COMMIT');

      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }

  // Settings

  getSettings(): BusinessSettings {
    const row = this.db.prepare(`SELECT value FROM settings WHERE key = 'business'`).get() as Row | undefined;

    return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.value) : {}) };
  }

  saveSettings(settings: BusinessSettings): BusinessSettings {
    this.db
      .prepare(`INSERT INTO settings (key, value) VALUES ('business', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(JSON.stringify(settings));

    return this.getSettings();
  }

  // Customers

  listCustomers(): Customer[] {
    return (this.db.prepare(`SELECT * FROM customers ORDER BY name COLLATE NOCASE`).all() as Row[]).map(toCustomer);
  }

  getCustomer(id: number): Customer {
    const row = this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id) as Row | undefined;

    if (!row) {
      throw new NotFoundError('Customer not found');
    }

    return toCustomer(row);
  }

  createCustomer(input: CustomerInput): Customer {
    const result = this.db
      .prepare(`INSERT INTO customers (name, company, email, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(input.name, input.company, input.email, input.phone, input.address, input.notes);

    return this.getCustomer(Number(result.lastInsertRowid));
  }

  updateCustomer(id: number, input: CustomerInput): Customer {
    const result = this.db
      .prepare(`UPDATE customers SET name = ?, company = ?, email = ?, phone = ?, address = ?, notes = ? WHERE id = ?`)
      .run(input.name, input.company, input.email, input.phone, input.address, input.notes, id);

    if (result.changes === 0) {
      throw new NotFoundError('Customer not found');
    }

    return this.getCustomer(id);
  }

  deleteCustomer(id: number) {
    const used = this.db.prepare(`SELECT COUNT(*) AS n FROM documents WHERE customer_id = ?`).get(id) as Row;

    if (used.n > 0) {
      throw new ConflictError('This customer has invoices or estimates and cannot be deleted');
    }

    if (this.db.prepare(`DELETE FROM customers WHERE id = ?`).run(id).changes === 0) {
      throw new NotFoundError('Customer not found');
    }
  }

  // Catalog items

  listItems(): CatalogItem[] {
    return (this.db.prepare(`SELECT * FROM items ORDER BY name COLLATE NOCASE`).all() as Row[]).map(toItem);
  }

  getItem(id: number): CatalogItem {
    const row = this.db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as Row | undefined;

    if (!row) {
      throw new NotFoundError('Item not found');
    }

    return toItem(row);
  }

  createItem(input: ItemInput): CatalogItem {
    const result = this.db
      .prepare(`INSERT INTO items (name, description, unit_price_cents, unit, taxable) VALUES (?, ?, ?, ?, ?)`)
      .run(input.name, input.description, input.unitPriceCents, input.unit, input.taxable ? 1 : 0);

    return this.getItem(Number(result.lastInsertRowid));
  }

  updateItem(id: number, input: ItemInput): CatalogItem {
    const result = this.db
      .prepare(`UPDATE items SET name = ?, description = ?, unit_price_cents = ?, unit = ?, taxable = ? WHERE id = ?`)
      .run(input.name, input.description, input.unitPriceCents, input.unit, input.taxable ? 1 : 0, id);

    if (result.changes === 0) {
      throw new NotFoundError('Item not found');
    }

    return this.getItem(id);
  }

  deleteItem(id: number) {
    if (this.db.prepare(`DELETE FROM items WHERE id = ?`).run(id).changes === 0) {
      throw new NotFoundError('Item not found');
    }
  }

  // Documents (invoices and estimates)

  private nextNumber(kind: DocumentKind): string {
    const settings = this.getSettings();
    const prefix = kind === 'invoice' ? settings.invoicePrefix : settings.estimatePrefix;
    const rows = this.db.prepare(`SELECT number FROM documents WHERE kind = ?`).all(kind) as Row[];
    let max = 0;

    for (const row of rows) {
      const match = /(\d+)$/.exec(row.number);

      if (match) {
        max = Math.max(max, Number(match[1]));
      }
    }

    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  createDocument(kind: DocumentKind, input: DocumentInput, sourceEstimateId: number | null = null): DocumentDetail {
    return this.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO documents (kind, number, state, customer_id, title, service_address, issue_date, due_date,
             notes, terms, discount_type, discount_value, tax_rate_bps, public_token, source_estimate_id)
           VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          kind,
          this.nextNumber(kind),
          input.customerId,
          input.title,
          input.serviceAddress,
          input.issueDate,
          input.dueDate,
          input.notes,
          input.terms,
          input.discountType,
          input.discountValue,
          input.taxRateBps,
          randomBytes(18).toString('base64url'),
          sourceEstimateId,
        );
      const id = Number(result.lastInsertRowid);

      this.replaceLines(id, input.lines);

      return this.getDocument(id);
    });
  }

  updateDocument(id: number, input: DocumentInput): DocumentDetail {
    const existing = this.getDocument(id);

    if (existing.state === 'void') {
      throw new ConflictError('Void invoices cannot be edited');
    }

    if (existing.kind === 'estimate' && existing.state === 'converted') {
      throw new ConflictError('This estimate was already converted to an invoice');
    }

    return this.transaction(() => {
      this.db
        .prepare(
          `UPDATE documents SET customer_id = ?, title = ?, service_address = ?, issue_date = ?, due_date = ?,
             notes = ?, terms = ?, discount_type = ?, discount_value = ?, tax_rate_bps = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(
          input.customerId,
          input.title,
          input.serviceAddress,
          input.issueDate,
          input.dueDate,
          input.notes,
          input.terms,
          input.discountType,
          input.discountValue,
          input.taxRateBps,
          id,
        );
      this.replaceLines(id, input.lines);

      return this.getDocument(id);
    });
  }

  private replaceLines(documentId: number, lines: LineItem[]) {
    this.db.prepare(`DELETE FROM line_items WHERE document_id = ?`).run(documentId);

    const insert = this.db.prepare(
      `INSERT INTO line_items (document_id, position, name, description, quantity, unit, unit_price_cents, taxable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    lines.forEach((line, position) => {
      insert.run(
        documentId,
        position,
        line.name,
        line.description,
        line.quantity,
        line.unit,
        line.unitPriceCents,
        line.taxable ? 1 : 0,
      );
    });
  }

  deleteDocument(id: number) {
    const doc = this.getDocument(id);

    if (doc.state !== 'draft') {
      throw new ConflictError('Only drafts can be deleted. Void the invoice instead.');
    }

    this.db.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
  }

  setState(id: number, state: string): DocumentDetail {
    const doc = this.getDocument(id);
    const allowed: Record<string, string[]> = {
      invoice: ['sent', 'void'],
      estimate: ['sent', 'accepted', 'declined'],
    };

    if (!allowed[doc.kind].includes(state)) {
      throw new ConflictError(`Cannot mark this ${doc.kind} as ${state}`);
    }

    if (doc.state === 'void' || doc.state === 'converted') {
      throw new ConflictError(`This ${doc.kind} is ${doc.state} and can no longer change`);
    }

    if (state === 'void' && doc.paidCents > 0) {
      throw new ConflictError('Remove recorded payments before voiding this invoice');
    }

    const sentAt = state === 'sent' ? (doc.sentAt ?? new Date().toISOString()) : doc.sentAt;

    this.db
      .prepare(`UPDATE documents SET state = ?, sent_at = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(state, sentAt, id);

    return this.getDocument(id);
  }

  convertEstimate(id: number): DocumentDetail {
    const estimate = this.getDocument(id);

    if (estimate.kind !== 'estimate') {
      throw new ConflictError('Only estimates can be converted');
    }

    if (estimate.state === 'converted') {
      throw new ConflictError('This estimate was already converted');
    }

    const settings = this.getSettings();
    const issueDate = localDate();

    return this.transaction(() => {
      const invoice = this.createDocument(
        'invoice',
        {
          ...documentInputFrom(estimate),
          issueDate,
          dueDate: addDays(issueDate, settings.defaultDueDays),
        },
        estimate.id,
      );

      this.db
        .prepare(`UPDATE documents SET state = 'converted', converted_to_id = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(invoice.id, estimate.id);

      return invoice;
    });
  }

  duplicateDocument(id: number): DocumentDetail {
    const source = this.getDocument(id);
    const settings = this.getSettings();
    const issueDate = localDate();

    return this.createDocument(source.kind, {
      ...documentInputFrom(source),
      issueDate,
      dueDate: source.kind === 'invoice' ? addDays(issueDate, settings.defaultDueDays) : source.dueDate,
    });
  }

  addPayment(documentId: number, input: PaymentInput): DocumentDetail {
    const doc = this.getDocument(documentId);

    if (doc.kind !== 'invoice') {
      throw new ConflictError('Payments can only be recorded on invoices');
    }

    if (doc.state === 'void') {
      throw new ConflictError('Cannot record a payment on a void invoice');
    }

    if (input.amountCents > doc.balanceCents) {
      throw new ConflictError('Payment is larger than the balance due');
    }

    this.db
      .prepare(`INSERT INTO payments (document_id, amount_cents, method, paid_at, note) VALUES (?, ?, ?, ?, ?)`)
      .run(documentId, input.amountCents, input.method, input.paidAt, input.note);

    // Recording a payment on a draft means it was delivered outside the app.
    if (doc.state === 'draft') {
      return this.setState(documentId, 'sent');
    }

    return this.getDocument(documentId);
  }

  deletePayment(documentId: number, paymentId: number): DocumentDetail {
    const result = this.db.prepare(`DELETE FROM payments WHERE id = ? AND document_id = ?`).run(paymentId, documentId);

    if (result.changes === 0) {
      throw new NotFoundError('Payment not found');
    }

    return this.getDocument(documentId);
  }

  getDocument(id: number): DocumentDetail {
    const row = this.db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as Row | undefined;

    if (!row) {
      throw new NotFoundError('Not found');
    }

    return this.hydrate(row);
  }

  getDocumentByToken(token: string): DocumentDetail {
    const row = this.db.prepare(`SELECT * FROM documents WHERE public_token = ?`).get(token) as Row | undefined;

    // Drafts are never visible to customers.
    if (!row || row.state === 'draft') {
      throw new NotFoundError('Not found');
    }

    return this.hydrate(row);
  }

  listDocuments(kind: DocumentKind, today = localDate()): DocumentSummary[] {
    const rows = this.db
      .prepare(`SELECT * FROM documents WHERE kind = ? ORDER BY issue_date DESC, id DESC`)
      .all(kind) as Row[];

    return rows.map((row) => summarize(this.hydrate(row, today)));
  }

  dashboard(today = localDate()): Dashboard {
    const invoices = this.listDocuments('invoice', today);
    const estimates = this.listDocuments('estimate', today);
    const since = addDays(today, -30);
    const paidLast30 = this.db
      .prepare(
        `SELECT COALESCE(SUM(p.amount_cents), 0) AS total FROM payments p
         JOIN documents d ON d.id = p.document_id WHERE d.state != 'void' AND p.paid_at >= ?`,
      )
      .get(since) as Row;
    const open = invoices.filter((doc) => ['unpaid', 'partial', 'overdue'].includes(doc.status));
    const overdue = invoices.filter((doc) => doc.status === 'overdue');

    return {
      outstandingCents: sum(open.map((doc) => doc.balanceCents)),
      overdueCents: sum(overdue.map((doc) => doc.balanceCents)),
      overdueCount: overdue.length,
      paidLast30Cents: Number(paidLast30.total),
      draftCount: invoices.filter((doc) => doc.status === 'draft').length,
      openEstimateCents: sum(estimates.filter((doc) => doc.status === 'sent').map((doc) => doc.totalCents)),
      recent: [...invoices, ...estimates]
        .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : b.id - a.id))
        .slice(0, 8),
    };
  }

  private hydrate(row: Row, today = localDate()): DocumentDetail {
    const lines = (
      this.db.prepare(`SELECT * FROM line_items WHERE document_id = ? ORDER BY position`).all(row.id) as Row[]
    ).map(toLine);
    const payments = (
      this.db.prepare(`SELECT * FROM payments WHERE document_id = ? ORDER BY paid_at, id`).all(row.id) as Row[]
    ).map(toPayment);
    const customer = row.customer_id
      ? toCustomerOrNull(this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(row.customer_id) as Row)
      : null;
    const totals = computeTotals({
      lines,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      taxRateBps: row.tax_rate_bps,
    });
    const paidCents = sum(payments.map((p) => p.amountCents));
    const status = deriveStatus({
      kind: row.kind,
      state: row.state,
      dueDate: row.due_date,
      totalCents: totals.totalCents,
      paidCents,
      today,
    });

    return {
      id: row.id,
      kind: row.kind,
      number: row.number,
      title: row.title,
      state: row.state,
      status,
      customerId: row.customer_id,
      customerName: customer ? customer.company || customer.name : '',
      customer,
      serviceAddress: row.service_address,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      notes: row.notes,
      terms: row.terms,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      taxRateBps: row.tax_rate_bps,
      lines,
      payments,
      totals,
      totalCents: totals.totalCents,
      paidCents,
      balanceCents: row.state === 'void' ? 0 : Math.max(0, totals.totalCents - paidCents),
      publicToken: row.public_token,
      sentAt: row.sent_at,
      convertedToId: row.converted_to_id,
      sourceEstimateId: row.source_estimate_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function documentInputFrom(doc: DocumentDetail): DocumentInput {
  return {
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
    lines: doc.lines.map(({ id: _id, ...line }) => line),
  };
}

function summarize(doc: DocumentDetail): DocumentSummary {
  return {
    id: doc.id,
    kind: doc.kind,
    number: doc.number,
    title: doc.title,
    customerId: doc.customerId,
    customerName: doc.customerName,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    status: doc.status,
    totalCents: doc.totalCents,
    paidCents: doc.paidCents,
    balanceCents: doc.balanceCents,
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function toCustomer(row: Row): Customer {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function toCustomerOrNull(row: Row | undefined): Customer | null {
  return row ? toCustomer(row) : null;
}

function toItem(row: Row): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unitPriceCents: row.unit_price_cents,
    unit: row.unit,
    taxable: row.taxable === 1,
  };
}

function toLine(row: Row): LineItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPriceCents: row.unit_price_cents,
    taxable: row.taxable === 1,
  };
}

function toPayment(row: Row): Payment {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    method: row.method,
    paidAt: row.paid_at,
    note: row.note,
  };
}
