CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY CHECK (id = 1),
  business_name text NOT NULL DEFAULT 'Your business',
  email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '', tax_id text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'INR', invoice_note text NOT NULL DEFAULT 'Thank you for your business.'
);
INSERT INTO settings(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text NOT NULL,
  name text NOT NULL, category text NOT NULL DEFAULT 'General',
  price_cents bigint NOT NULL CHECK(price_cents >= 0),
  cost_cents bigint NOT NULL DEFAULT 0 CHECK(cost_cents >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0),
  reorder_level integer NOT NULL DEFAULT 5 CHECK(reorder_level >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON products(lower(sku));
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  email text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '', tax_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL DEFAULT ('INV-' || nextval('invoice_number_seq')),
  customer_id uuid NOT NULL REFERENCES customers(id),
  customer_snapshot jsonb NOT NULL, business_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','paid','void')),
  issue_date date NOT NULL, due_date date NOT NULL CHECK(due_date >= issue_date),
  tax_bps integer NOT NULL DEFAULT 0 CHECK(tax_bps BETWEEN 0 AND 10000),
  subtotal_cents bigint NOT NULL CHECK(subtotal_cents >= 0),
  tax_cents bigint NOT NULL CHECK(tax_cents >= 0),
  total_cents bigint NOT NULL CHECK(total_cents >= 0),
  notes text NOT NULL DEFAULT '', paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  name text NOT NULL, sku text NOT NULL,
  quantity integer NOT NULL CHECK(quantity > 0),
  price_cents bigint NOT NULL CHECK(price_cents >= 0),
  line_total_cents bigint NOT NULL CHECK(line_total_cents >= 0)
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  invoice_id uuid REFERENCES invoices(id),
  quantity integer NOT NULL CHECK(quantity <> 0),
  reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_customer_idx ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS movement_product_idx ON stock_movements(product_id, created_at DESC);
