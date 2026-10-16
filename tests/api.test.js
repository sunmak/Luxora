import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";

// All tests run in a disposable database, never against your inventory.
const admin = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://luxora:luxora_dev@127.0.0.1:5432/luxora",
});
const dbName = "luxora_test_" + randomUUID().replaceAll("-", "");
let server, pool, base;
before(async () => {
  await admin.query(`CREATE DATABASE "${dbName}"`);
  const url = new URL(
    process.env.DATABASE_URL ||
      "postgres://luxora:luxora_dev@127.0.0.1:5432/luxora",
  );
  url.pathname = "/" + dbName;
  process.env.DATABASE_URL = url.toString();
  ({ pool } = await import("../server/db.js"));
  const { migrate } = await import("../server/migrate.js");
  await migrate();
  const { app } = await import("../server/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (pool) await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.end();
});
async function request(path, method = "GET", body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json() };
}
const product = (stock = 10, other = {}) =>
  request("/products", "POST", {
    name: "Test product",
    sku: randomUUID(),
    category: "General",
    price_cents: 12345,
    cost_cents: 6000,
    reorder_level: 5,
    stock,
    ...other,
  });
const customer = () =>
  request("/customers", "POST", {
    name: "Test customer",
    email: "customer@example.com",
    phone: "",
    address: "Test address",
    tax_id: "",
  });
const draft = (p, c, qty = 2, other = {}) =>
  request("/invoices", "POST", {
    customer_id: c.id,
    issue_date: "2026-10-16",
    due_date: "2026-10-30",
    tax_bps: 1800,
    notes: "Test",
    items: [{ product_id: p.id, quantity: qty, price_cents: p.price_cents }],
    ...other,
  });

test("health checks a real PostgreSQL connection", async () => {
  const r = await request("/health");
  assert.equal(r.status, 200);
  assert.equal(r.data.database, "postgresql");
});
test("product validation and case-insensitive unique SKU", async () => {
  const p = await product(10, { sku: "CASE-test" });
  assert.equal(p.status, 201);
  assert.equal(p.data.stock, 10);
  assert.equal((await product(1, { sku: "case-TEST" })).status, 409);
  assert.equal((await product(-1)).status, 400);
  assert.equal((await product(1, { price_cents: 1.1 })).status, 400);
});
test("stock adjustments cannot make stock negative; history is recorded", async () => {
  const { data: p } = await product(3);
  assert.equal(
    (
      await request(`/products/${p.id}/stock`, "POST", {
        quantity: -4,
        reason: "Damage",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/products/${p.id}/stock`, "POST", {
        quantity: 5,
        reason: "Restock",
      })
    ).data.stock,
    8,
  );
  assert.equal(
    (
      await request(`/products/${p.id}/stock`, "POST", {
        quantity: 0,
        reason: "Nothing",
      })
    ).status,
    400,
  );
  const history = await request(`/products/${p.id}/movements`);
  assert.equal(history.data.length, 2);
  assert.ok(
    history.data.some((m) => m.quantity === 5 && m.reason === "Restock"),
  );
});
test("draft totals round tax to cents, retain snapshots, and do not change stock", async () => {
  const { data: p } = await product(9);
  const { data: c } = await customer();
  const r = await draft(p, c, 3, {
    items: [{ product_id: p.id, quantity: 3, price_cents: 1001 }],
    tax_bps: 725,
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.subtotal_cents, 3003);
  assert.equal(r.data.tax_cents, 218);
  assert.equal(r.data.total_cents, 3221);
  assert.equal(
    (await request("/products")).data.find((v) => v.id === p.id).stock,
    9,
  );
  await request(`/customers/${c.id}`, "PUT", { ...c, name: "Updated name" });
  const detail = (await request(`/invoices/${r.data.id}`)).data;
  assert.equal(detail.customer_snapshot.name, "Test customer");
  assert.equal(detail.items.length, 1);
});
test("invoice validation rejects bad dates, duplicate products, and fractional quantities", async () => {
  const { data: p } = await product();
  const { data: c } = await customer();
  assert.equal((await draft(p, c, 1, { due_date: "2026-10-01" })).status, 400);
  assert.equal(
    (await draft(p, c, 1, { issue_date: "2026-02-31" })).status,
    400,
  );
  assert.equal((await draft(p, c, 1, { items: [] })).status, 400);
  assert.equal((await draft(p, c, 1.5)).status, 400);
  assert.equal(
    (
      await draft(p, c, 1, {
        items: [
          { product_id: p.id, quantity: 1, price_cents: 10 },
          { product_id: p.id, quantity: 1, price_cents: 10 },
        ],
      })
    ).status,
    400,
  );
});
test("issuing an invoice deducts stock exactly once, and void restores it once", async () => {
  const { data: p } = await product(10);
  const { data: c } = await customer();
  const { data: i } = await draft(p, c, 4);
  assert.equal(
    (await request(`/invoices/${i.id}/issue`, "POST", {})).data.status,
    "issued",
  );
  assert.equal(
    (await request(`/invoices/${i.id}/issue`, "POST", {})).status,
    409,
  );
  assert.equal(
    (await request("/products")).data.find((v) => v.id === p.id).stock,
    6,
  );
  assert.equal(
    (await request(`/invoices/${i.id}/void`, "POST", {})).data.status,
    "void",
  );
  assert.equal(
    (await request(`/invoices/${i.id}/void`, "POST", {})).status,
    409,
  );
  assert.equal(
    (await request("/products")).data.find((v) => v.id === p.id).stock,
    10,
  );
});
test("concurrent issuing cannot oversell shared stock", async () => {
  const { data: p } = await product(5);
  const { data: c } = await customer();
  const a = await draft(p, c, 4),
    b = await draft(p, c, 4);
  const results = await Promise.all(
    [a, b].map((i) => request(`/invoices/${i.data.id}/issue`, "POST", {})),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await request("/products")).data.find((v) => v.id === p.id).stock,
    1,
  );
  const failed = results.findIndex((r) => r.status === 409);
  assert.equal(
    (await request(`/invoices/${[a, b][failed].data.id}`)).data.status,
    "draft",
  );
});
test("multi-product insufficient stock rolls back the entire invoice", async () => {
  const { data: a } = await product(10),
    { data: b } = await product(1),
    { data: c } = await customer();
  const { data: i } = await draft(a, c, 1, {
    items: [
      { product_id: a.id, quantity: 3, price_cents: 100 },
      { product_id: b.id, quantity: 2, price_cents: 100 },
    ],
  });
  assert.equal(
    (await request(`/invoices/${i.id}/issue`, "POST", {})).status,
    409,
  );
  const ps = (await request("/products")).data;
  assert.equal(ps.find((p) => p.id === a.id).stock, 10);
  assert.equal(ps.find((p) => p.id === b.id).stock, 1);
  assert.equal((await request(`/invoices/${i.id}`)).data.status, "draft");
});
test("payment requires issued status; paid invoices cannot be voided", async () => {
  const { data: p } = await product(10),
    { data: c } = await customer(),
    { data: i } = await draft(p, c);
  assert.equal(
    (await request(`/invoices/${i.id}/pay`, "POST", {})).status,
    409,
  );
  await request(`/invoices/${i.id}/issue`, "POST", {});
  const result = await request(`/invoices/${i.id}/pay`, "POST", {});
  assert.equal(result.data.status, "paid");
  assert.ok(result.data.paid_at);
  assert.equal(
    (await request(`/invoices/${i.id}/void`, "POST", {})).status,
    409,
  );
  assert.equal(
    (await request(`/invoices/${i.id}/pay`, "POST", {})).status,
    409,
  );
});
test("dashboard reports real totals and 6 chart months", async () => {
  const { data: d } = await request("/dashboard");
  assert.ok(d.revenue_cents > 0);
  assert.ok(d.product_count > 0);
  assert.equal(d.monthly.length, 6);
  assert.ok(Array.isArray(d.activity));
});
test("cross-site writes are rejected", async () => {
  const r = await fetch(base + "/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
    body: JSON.stringify({ name: "Unwanted" }),
  });
  assert.equal(r.status, 403);
});
test("unknown resources return structured errors", async () => {
  assert.equal((await request("/invoices/" + randomUUID())).status, 404);
  assert.equal((await request("/products/not-a-uuid", "PUT", {})).status, 400);
  assert.equal((await request("/unknown")).status, 404);
});
