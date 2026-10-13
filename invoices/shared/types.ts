import type { DiscountType, EstimateStatus, InvoiceStatus, Totals } from './totals.ts';

export type DocumentKind = 'invoice' | 'estimate';

export interface BusinessSettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  license: string;
  defaultTaxRateBps: number;
  defaultDueDays: number;
  defaultTerms: string;
  defaultNotes: string;
  paymentInstructions: string;
  invoicePrefix: string;
  estimatePrefix: string;

  // A small image as a data: URL, shown at the top of every invoice.
  logoDataUrl: string;

  // Hex color used for headings and rules on invoices.
  brandColor: string;
}

export interface Customer {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
}

export interface CatalogItem {
  id: number;
  name: string;
  description: string;
  unitPriceCents: number;
  unit: string;
  taxable: boolean;
}

export interface LineItem {
  id?: number;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  taxable: boolean;
}

export interface Payment {
  id: number;
  amountCents: number;
  method: string;
  paidAt: string;
  note: string;
}

export type EventType =
  | 'created'
  | 'sent'
  | 'viewed'
  | 'payment'
  | 'payment_removed'
  | 'accepted'
  | 'declined'
  | 'voided'
  | 'converted';

export interface DocumentEvent {
  id: number;
  type: EventType;
  at: string;
  detail: string;
}

export interface Attachment {
  id: number;
  filename: string;
  caption: string;
  width: number;
  height: number;
  url: string;
}

export interface DocumentSummary {
  id: number;
  kind: DocumentKind;
  number: string;
  title: string;
  customerId: number | null;
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  status: InvoiceStatus | EstimateStatus;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  viewedAt: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  state: string;
  customer: Customer | null;
  serviceAddress: string;
  notes: string;
  terms: string;
  discountType: DiscountType;
  discountValue: number;
  taxRateBps: number;
  depositType: DiscountType;
  depositValue: number;

  // Requested deposit, and how much of it is still unpaid.
  depositCents: number;
  depositDueCents: number;
  viewCount: number;
  acceptedName: string;
  acceptedAt: string | null;
  lines: LineItem[];
  payments: Payment[];
  events: DocumentEvent[];
  attachments: Attachment[];
  totals: Totals;
  publicToken: string;
  sentAt: string | null;
  convertedToId: number | null;
  sourceEstimateId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dashboard {
  outstandingCents: number;
  overdueCents: number;
  overdueCount: number;
  paidLast30Cents: number;
  draftCount: number;
  openEstimateCents: number;
  recent: DocumentSummary[];
}

export interface PublicDocument {
  business: BusinessSettings;
  document: DocumentDetail;
}
