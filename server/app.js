import express from "express";
import { z } from "zod";
import { pool, transaction } from "./db.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

// pg returns bigint as strings; amounts stay below Number.MAX_SAFE_INTEGER.
const normalize = (row) =>
  row &&
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      key.endsWith("_cents") ? Number(value) : value,
    ]),
  );
const money = z.number().int().min(0).max(100_000_000);
const text = (max) => z.string().trim().max(max);
const required = (max) => text(max).min(1);
const productSchema = z.object({
  name: required(160),
  sku: required(60),
  category: required(80),
  price_cents: money,
  cost_cents: money.default(0),
  reorder_level: z.number().int().min(0).max(1_000_000),
});
const customerSchema = z.object({
  name: required(160),
  email: z.union([z.email(), z.literal("")]).default(""),
  phone: text(60).default(""),
  address: text(1000).default(""),
  tax_id: text(80).default(""),
});
const date = z.iso.date();
const invoiceSchema = z
  .object({
    customer_id: z.uuid(),
    issue_date: date,
    due_date: date,
    tax_bps: z.number().int().min(0).max(10000),
    notes: text(2000).default(""),
    items: z
      .array(
        z.object({
          product_id: z.uuid(),
          quantity: z.number().int().min(1).max(1_000_000),
          price_cents: money,
        }),
      )
      .min(1)
      .max(100),
  })
  .refine((v) => v.due_date >= v.issue_date, {
    message: "Due date must be on or after invoice date.",
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.product_id)).size === v.items.length,
    { message: "Add each product only once." },
  );
const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const uuid = (value) => z.uuid().parse(value);

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
  next();
});
// This app is intended for a trusted local workspace. Reject cross-site mutations.
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      req.get("sec-fetch-site") === "cross-site" ||
      (origin && new URL(origin).host !== req.get("host"))
    )
      return res
        .status(403)
        .json({ error: "Cross-site requests are not allowed." });
  }
  next();
});
app.get("/api/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok", database: "postgresql" });
});
app.get("/api/settings", async (req, res) =>
  res.json((await pool.query("SELECT * FROM settings WHERE id=1")).rows[0]),
);
app.put("/api/settings", async (req, res) => {
  const s = z
    .object({
      business_name: required(160),
      email: z.union([z.email(), z.literal("")]),
      phone: text(60),
      address: text(1000),
      tax_id: text(80),
      invoice_note: text(2000),
    })
    .parse(req.body);
  const { rows } = await pool.query(
    "UPDATE settings SET business_name=$1,email=$2,phone=$3,address=$4,tax_id=$5,invoice_note=$6 WHERE id=1 RETURNING *",
    Object.values(s),
  );
  res.json(rows[0]);
});
app.get("/api/products", async (req, res) =>
  res.json(
    (
      await pool.query("SELECT * FROM products ORDER BY created_at DESC,name")
    ).rows.map(normalize),
  ),
);
app.post("/api/products", async (req, res) => {
  const p = productSchema
    .extend({ stock: z.number().int().min(0).max(1_000_000).default(0) })
    .parse(req.body);
  const result = await transaction(async (c) => {
    const { rows } = await c.query(
      "INSERT INTO products(name,sku,category,price_cents,cost_cents,reorder_level,stock) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      Object.values(p),
    );
    if (p.stock)
      await c.query(
        "INSERT INTO stock_movements(product_id,quantity,reason) VALUES($1,$2,$3)",
        [rows[0].id, p.stock, "Opening stock"],
      );
    return normalize(rows[0]);
  });
  res.status(201).json(result);
});
app.put("/api/products/:id", async (req, res) => {
  const p = productSchema.parse(req.body);
  const { rows } = await pool.query(
    "UPDATE products SET name=$1,sku=$2,category=$3,price_cents=$4,cost_cents=$5,reorder_level=$6 WHERE id=$7 RETURNING *",
    [...Object.values(p), uuid(req.params.id)],
  );
  if (!rows.length) fail(404, "Product not found.");
  res.json(normalize(rows[0]));
});
app.post("/api/products/:id/stock", async (req, res) => {
  const { quantity, reason } = z
    .object({
      quantity: z
        .number()
        .int()
        .min(-1_000_000)
        .max(1_000_000)
        .refine((n) => n !== 0),
      reason: required(300),
    })
    .parse(req.body);
  const result = await transaction(async (c) => {
    const { rows } = await c.query(
      "SELECT * FROM products WHERE id=$1 FOR UPDATE",
      [uuid(req.params.id)],
    );
    if (!rows.length) fail(404, "Product not found.");
    if (rows[0].stock + quantity < 0)
      fail(409, "Adjustment would make stock negative.");
    if (rows[0].stock + quantity > 1_000_000_000)
      fail(409, "Stock limit exceeded.");
    await c.query(
      "INSERT INTO stock_movements(product_id,quantity,reason) VALUES($1,$2,$3)",
      [rows[0].id, quantity, reason],
    );
    return normalize(
      (
        await c.query(
          "UPDATE products SET stock=stock+$1 WHERE id=$2 RETURNING *",
          [quantity, rows[0].id],
        )
      ).rows[0],
    );
  });
  res.json(result);
});
app.get("/api/products/:id/movements", async (req, res) =>
  res.json(
    (
      await pool.query(
        "SELECT m.*,i.number AS invoice_number FROM stock_movements m LEFT JOIN invoices i ON i.id=m.invoice_id WHERE m.product_id=$1 ORDER BY m.created_at DESC LIMIT 100",
        [uuid(req.params.id)],
      )
    ).rows,
  ),
);
app.get("/api/customers", async (req, res) =>
  res.json(
    (
      await pool.query(
        `SELECT c.*,count(i.id)::int AS invoice_count,COALESCE(sum(i.total_cents) FILTER(WHERE i.status IN ('issued','paid')),0) AS total_cents FROM customers c LEFT JOIN invoices i ON i.customer_id=c.id GROUP BY c.id ORDER BY c.name`,
      )
    ).rows.map(normalize),
  ),
);
app.post("/api/customers", async (req, res) => {
  const c = customerSchema.parse(req.body);
  res
    .status(201)
    .json(
      (
        await pool.query(
          "INSERT INTO customers(name,email,phone,address,tax_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
          Object.values(c),
        )
      ).rows[0],
    );
});
app.put("/api/customers/:id", async (req, res) => {
  const c = customerSchema.parse(req.body);
  const { rows } = await pool.query(
    "UPDATE customers SET name=$1,email=$2,phone=$3,address=$4,tax_id=$5 WHERE id=$6 RETURNING *",
    [...Object.values(c), uuid(req.params.id)],
  );
  if (!rows.length) fail(404, "Customer not found.");
  res.json(rows[0]);
});
app.get("/api/invoices", async (req, res) =>
  res.json(
    (
      await pool.query(
        `SELECT i.*, (SELECT count(*)::int FROM invoice_items WHERE invoice_id=i.id) AS item_count FROM invoices i ORDER BY i.created_at DESC`,
      )
    ).rows.map(normalize),
  ),
);
app.get("/api/invoices/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM invoices WHERE id=$1", [
    uuid(req.params.id),
  ]);
  if (!rows.length) fail(404, "Invoice not found.");
  const items = (
    await pool.query(
      "SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY id",
      [req.params.id],
    )
  ).rows.map(normalize);
  res.json({ ...normalize(rows[0]), items });
});
app.post("/api/invoices", async (req, res) => {
  const v = invoiceSchema.parse(req.body);
  const invoice = await transaction(async (c) => {
    const customer = (
      await c.query("SELECT * FROM customers WHERE id=$1", [v.customer_id])
    ).rows[0];
    if (!customer) fail(404, "Customer not found.");
    const business = (await c.query("SELECT * FROM settings WHERE id=1"))
      .rows[0];
    const products = (
      await c.query("SELECT * FROM products WHERE id=ANY($1::uuid[])", [
        v.items.map((i) => i.product_id),
      ])
    ).rows;
    if (products.length !== v.items.length)
      fail(400, "One or more products no longer exist.");
    const items = v.items.map((i) => ({
      ...i,
      ...Object.fromEntries(
        ["name", "sku"].map((k) => [
          k,
          products.find((p) => p.id === i.product_id)[k],
        ]),
      ),
      line_total_cents: i.quantity * i.price_cents,
    }));
    const subtotal = items.reduce((sum, i) => sum + i.line_total_cents, 0);
    if (subtotal > 1_000_000_000_000)
      fail(400, "Invoice total exceeds the supported limit.");
    const tax = Math.round((subtotal * v.tax_bps) / 10000);
    const { rows } = await c.query(
      "INSERT INTO invoices(customer_id,customer_snapshot,business_snapshot,issue_date,due_date,tax_bps,subtotal_cents,tax_cents,total_cents,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [
        v.customer_id,
        customer,
        business,
        v.issue_date,
        v.due_date,
        v.tax_bps,
        subtotal,
        tax,
        subtotal + tax,
        v.notes,
      ],
    );
    for (const i of items)
      await c.query(
        "INSERT INTO invoice_items(invoice_id,product_id,name,sku,quantity,price_cents,line_total_cents) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          rows[0].id,
          i.product_id,
          i.name,
          i.sku,
          i.quantity,
          i.price_cents,
          i.line_total_cents,
        ],
      );
    return normalize(rows[0]);
  });
  res.status(201).json(invoice);
});
app.post("/api/invoices/:id/:action", async (req, res) => {
  const action = z.enum(["issue", "pay", "void"]).parse(req.params.action);
  const result = await transaction(async (c) => {
    const invoice = (
      await c.query("SELECT * FROM invoices WHERE id=$1 FOR UPDATE", [
        uuid(req.params.id),
      ])
    ).rows[0];
    if (!invoice) fail(404, "Invoice not found.");
    if (action === "issue" && invoice.status !== "draft")
      fail(409, "Only a draft invoice can be issued.");
    if (action === "pay" && invoice.status !== "issued")
      fail(409, "Only an issued invoice can be marked paid.");
    if (action === "void" && !["draft", "issued"].includes(invoice.status))
      fail(409, "Only an unpaid invoice can be voided.");
    if (
      action === "issue" ||
      (action === "void" && invoice.status === "issued")
    ) {
      const items = (
        await c.query(
          "SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY product_id",
          [invoice.id],
        )
      ).rows;
      for (const i of items) {
        const product = (
          await c.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [
            i.product_id,
          ])
        ).rows[0];
        const quantity = action === "issue" ? -i.quantity : i.quantity;
        if (product.stock + quantity < 0)
          fail(
            409,
            `Insufficient stock for ${product.name}: ${product.stock} available, ${i.quantity} required.`,
          );
        await c.query("UPDATE products SET stock=stock+$1 WHERE id=$2", [
          quantity,
          product.id,
        ]);
        await c.query(
          "INSERT INTO stock_movements(product_id,invoice_id,quantity,reason) VALUES($1,$2,$3,$4)",
          [
            product.id,
            invoice.id,
            quantity,
            `${action === "issue" ? "Invoice issued" : "Invoice voided"} · ${invoice.number}`,
          ],
        );
      }
    }
    const status = { issue: "issued", pay: "paid", void: "void" }[action];
    return normalize(
      (
        await c.query(
          "UPDATE invoices SET status=$1,paid_at=CASE WHEN $1='paid' THEN now() ELSE NULL END WHERE id=$2 RETURNING *",
          [status, invoice.id],
        )
      ).rows[0],
    );
  });
  res.json(result);
});
app.get("/api/dashboard", async (req, res) => {
  const [summary, inventory, monthly, activity] = await Promise.all([
    pool.query(
      `SELECT COALESCE(sum(total_cents) FILTER(WHERE status='paid'),0) AS revenue_cents,COALESCE(sum(total_cents) FILTER(WHERE status='issued'),0) AS outstanding_cents,count(*) FILTER(WHERE status='issued' AND due_date<CURRENT_DATE)::int AS overdue_count,count(*)::int AS invoice_count FROM invoices`,
    ),
    pool.query(
      "SELECT count(*)::int AS product_count,COALESCE(sum(stock),0)::int AS units,count(*) FILTER(WHERE stock<=reorder_level)::int AS low_stock_count,COALESCE(sum(stock*cost_cents),0) AS value_cents FROM products",
    ),
    pool.query(
      `SELECT to_char(month,'YYYY-MM') AS month,COALESCE(sum(i.total_cents),0) AS revenue_cents FROM generate_series(date_trunc('month',CURRENT_DATE)-interval '5 months',date_trunc('month',CURRENT_DATE),interval '1 month') month LEFT JOIN invoices i ON i.status='paid' AND date_trunc('month',i.paid_at)=month GROUP BY month ORDER BY month`,
    ),
    pool.query(
      "SELECT m.*,p.name,p.sku FROM stock_movements m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC LIMIT 5",
    ),
  ]);
  res.json({
    ...normalize(summary.rows[0]),
    ...normalize(inventory.rows[0]),
    monthly: monthly.rows.map(normalize),
    activity: activity.rows,
  });
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.use(express.static(path.join(root, "dist")));
app.get("/{*path}", (req, res) =>
  res.sendFile(path.join(root, "dist", "index.html")),
);
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError)
    return res
      .status(400)
      .json({
        error: err.issues
          .map((i) => `${i.path.join(".") || "Invoice"}: ${i.message}`)
          .join("; "),
      });
  if (err.code === "23505")
    return res
      .status(409)
      .json({ error: "That SKU already exists. Please use a unique SKU." });
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON request." });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});
