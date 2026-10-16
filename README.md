# Luxora

An inventory and invoicing workspace built with **React (JavaScript), Node.js / Express, and PostgreSQL**. Includes a responsive dashboard, searchable product catalog, customer management, stock adjustment history, invoice drafts, issuing, payment tracking, voiding, CSV inventory export, and printable invoices / Save as PDF.

## Run locally

Requirements: **Node.js 22.12+** (tested on Node 24), npm, and Docker with Docker Compose. PostgreSQL 17 is provided by Compose; you can also use an existing PostgreSQL database through `DATABASE_URL`.

```bash
npm ci
cp .env.example .env  # only if you do not already have .env
# Uses a persistent named Docker volume. Do not delete the volume to restart.
docker compose up -d --wait
npm run db:migrate
npm run db:seed       # optional: adds clearly fictional sample products, customers and invoices
npm run dev
```

Open the Vite development server on port **5173**. It proxies `/api` to the Node server on port **3001**. The onboarding instance has sample data loaded. For a new, empty workspace, omit `db:seed` against a new database. The seed command skips databases that already contain products and never clears existing data.

The `.env.example` password is for local development only. Keep `.env` out of Git. If changing the database password, set `POSTGRES_PASSWORD` for Compose and update the password in `DATABASE_URL`. PostgreSQL's initialization credentials only apply to a **new** volume; changing the environment does not change passwords in an existing database.

First, visit **Business settings** and enter your business name, billing address, email, tax ID and payment instructions. These appear on new invoices. All amounts use **INR**; currency is fixed for consistent reporting.

## How invoicing works

1. Add products with unique SKUs, cost / selling prices, opening stock and reorder thresholds.
2. Add your customers and billing details.
3. Create a draft invoice. Prices default from the catalog and can be overridden per invoice. Set dates, quantities, a tax percentage and notes.
4. **Issue** the invoice to deduct stock. Insufficient stock prevents issuing the entire invoice.
5. Print the invoice and choose **Save as PDF** in the browser's print dialog, or print on paper.
6. Use **Mark paid** only after the full payment is received. This records payment; it does not charge a card or connect to a payment provider.
7. **Void** an unpaid invoice to cancel it. Issued invoices restore stock; drafts never affected stock. Paid invoices cannot be voided. To correct a draft, void it and create a replacement.

Product stock can only change through opening stock, an explicit adjustment with a reason, issuing an invoice, or voiding an issued invoice. Negative adjustments represent damage, returns to suppliers, or other stock corrections. All movements are logged.

Customer and business details are snapshotted on invoice creation; future edits do not rewrite old invoices. Prices and descriptions are also snapshotted. Tax is one invoice-wide rate, rounded once to the nearest paisa. Monetary values are stored as integer paise, avoiding floating-point totals. Invoice numbers come from a database sequence and may contain gaps.

**Revenue** is the total of fully paid invoices (including tax). **Outstanding** is the total of unpaid issued invoices (including overdue invoices). **Inventory value** is current stock at cost. The chart groups payments by payment month; it is not an accounting profit report. The database calendar determines dashboard overdue counts; dates on the client use the browser's calendar.

## Verification

```bash
npm test              # 12 PostgreSQL-backed API/integration tests
npm run test:browser  # builds, then exercises the actual UI in Chromium
npm run build         # production build
```

Tests create and drop uniquely named disposable databases. They do not clear your business database. The configured PostgreSQL role needs `CREATEDB` for tests (the local Compose role has it). Browser tests use `/usr/bin/chromium` if available. Otherwise run `npx playwright install chromium`, or set `CHROMIUM_PATH` to an installed Chromium executable. Browser installation may require allowing `cdn.playwright.dev` and its download destinations in your environment's network policy.

Tests cover totals and tax rounding, validation, case-insensitive unique SKUs, invoice snapshots, stock history, concurrent issuance / overselling, full transaction rollback, void stock restoration, payment transitions, cross-site write rejection, and a desktop / mobile browser workflow. The browser test also generates a PDF under `/tmp`.

## Production build / local service

```bash
npm run build
NODE_ENV=production npm start
```

Express serves both the compiled React app and the API on port 3001. The schema migration runs on API startup and can also be run explicitly. Migration and seed commands can be rerun. Processes need restarting after an environment restore; stored database data is separate from the running processes.

This version is a **single-business application for a trusted local workspace**. It has no user authentication or permission system. Do not expose the server to the public Internet without adding authentication, authorization, HTTPS, rate limits, secure deployment configuration and database backups. PostgreSQL's Compose port binds only to loopback. Node and Vite listen on all interfaces for cloud workspace use.

There is no automatic emailing, online payment processing, partial payments, refunds, multiple warehouses, or multi-currency support. The single tax field and printable invoice are generic; jurisdiction-specific GST splits, tax filings and statutory invoice requirements are outside this version.

## Data persistence and backups

Compose stores PostgreSQL data in the named `luxora-postgres-data` volume. `docker compose stop` stops the database without removing data. Do **not** use `docker compose down -v` unless you intend to erase the database.

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U luxora luxora > backups/luxora.sql
# Restore into an empty compatible database, after reviewing the backup:
# docker compose exec -T postgres psql -U luxora -d luxora < backups/luxora.sql
```

Backups contain business data and should be protected and stored outside the development machine. A Docker volume's availability in a new cloud machine depends on the platform; use PostgreSQL backups or a managed persistent database for durable real business data.

## Project layout

- `src/main.jsx`: React views, forms, navigation and API client.
- `src/styles.css`: responsive application styling and print stylesheet.
- `server/app.js`: validated REST API and transactional invoice operations.
- `server/schema.sql`: PostgreSQL tables, checks and indexes.
- `server/migrate.js`, `server/seed.js`: repeatable schema setup and optional demo data.
- `tests/`: isolated database integration tests and browser workflow tests.
- `compose.yaml`: local PostgreSQL service.

Use the existing checkout for development; cloud tasks already have isolated workspaces, so an additional Git worktree is unnecessary.
