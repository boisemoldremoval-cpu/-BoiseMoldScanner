# Invoices

A self-hosted invoicing app modeled on the core workflow of Square Invoices: create estimates and invoices, send customers a link, track payments, and print or save PDFs. The business details and branding are your own.

## What it does

- **Invoices and estimates**, with automatic numbering (`INV-0001`, `EST-0001`, prefixes are configurable).
- **Line items** with quantity, unit (sq ft, hour, visit…) and price. Each line can be marked taxable or not. Lines can be reordered.
- **Discounts** (percent or fixed amount) and a **tax rate**. The discount reduces the taxable amount proportionally.
- **Services catalog**: save services you bill often and add them to an invoice in one click.
- **Customers**, with billing address, a per-job service address and private notes. Customers never see the notes.
- **Send**: marks the invoice as sent and gives you a private customer link. You can copy it, email it (opens your mail app with a pre-written message) or text it.
- **Customer page**: shows the amount due and a printable invoice, and works on phones. For estimates, the customer can **accept or decline** from this page.
- **Payments**: record cash, check, card, bank transfer or other payments, including partial payments. Status updates automatically: Unpaid → Partially paid → Paid, or Overdue once past the due date.
- **Estimate → invoice** conversion in one click. Invoices can also be duplicated.
- **Void** sent invoices so they stay in your records. Only drafts can be deleted.
- **Overview dashboard**: outstanding, overdue, paid in the last 30 days, and open estimates.
- **Print / PDF**: the browser's print dialog produces a clean one-page invoice ("Save as PDF").

## Running it

Requires Node.js 22.18 or newer. The database is the SQLite built into Node, so there is nothing else to install.

```bash
cd invoices
pnpm install
pnpm dev            # http://127.0.0.1:5174
```

Start in **Settings**: add your business name, contact details, default tax rate and payment instructions. They appear on every invoice.

### Production

```bash
pnpm build
ADMIN_PASSWORD='choose-a-long-password' HOST=0.0.0.0 PORT=3000 pnpm start
```

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | unset | Required for any non-local access. Without it the server only listens on 127.0.0.1 and refuses to start on a public address. |
| `DATABASE_PATH` | `data/invoices.db` | SQLite file. **Back this file up**, because it holds all your records. |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Where the server listens. |

Put the server behind HTTPS (for example Caddy, nginx or a hosting platform's proxy) before sending customer links. Over HTTPS the session cookie is marked `Secure` automatically.

Customer links (`/#/i/<token>`) need no sign-in. Each one is a random, unguessable token, and drafts are never visible through it.

## Checks

```bash
pnpm test        # money math and API tests
pnpm typecheck
pnpm build
```

## Not built yet

- **Online card payments** on the customer page. This needs a payment processor account; Stripe or Square's own API are the usual choices.
- **Sending email from the app.** Today "Email" opens your own mail app. Automatic sending, payment reminders and receipts need an email service such as Postmark, SendGrid or SMTP.
- **Recurring invoices**, deposits and payment schedules, attachments and photos on invoices, and multiple staff logins.
