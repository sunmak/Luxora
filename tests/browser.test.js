import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
const admin = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://luxora:luxora_dev@127.0.0.1:5432/luxora",
});
const dbName = "luxora_browser_" + randomUUID().replaceAll("-", "");
let pool, server, browser, page, base;
const errors = [];
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
  base = `http://127.0.0.1:${server.address().port}`;
  const executablePath =
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (e) => errors.push(e.message));
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  await pool?.end();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.end();
});
const waitForText = async (text) =>
  page.getByText(text, { exact: true }).waitFor();
async function closeInvoice() {
  await page.getByRole("button", { name: "Close dialog" }).click();
}
async function makeDraft() {
  await page
    .getByRole("button", { name: "Create invoice", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Bill to", { exact: true })
    .selectOption({ label: "Browser customer" });
  await page
    .getByRole("combobox", { name: "Product 1", exact: true })
    .selectOption({ label: "Browser lamp (8 in stock)" });
  await page
    .getByRole("spinbutton", { name: "Quantity 1", exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Issue invoice", exact: true })
    .waitFor();
}
test("complete business workflow in the browser with persistent PostgreSQL data", async () => {
  await page.goto(base);
  await waitForText("Recent invoices");
  await page.getByRole("link", { name: "Business settings" }).click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Browser business");
  await page
    .getByLabel("Business email", { exact: true })
    .fill("business@example.com");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await waitForText(
    "Business details saved. New invoices will use these details.",
  );
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page
    .getByRole("button", { name: "Add product", exact: true })
    .first()
    .click();
  await page.getByLabel("Product name", { exact: true }).fill("Browser lamp");
  await page.getByLabel("SKU", { exact: true }).fill("BROWSER-001");
  await page.getByLabel("Category", { exact: true }).fill("Lighting");
  await page.getByLabel("Selling price (₹)", { exact: true }).fill("100.01");
  await page.getByLabel("Cost price (₹)", { exact: true }).fill("50");
  await page.getByLabel("Opening stock", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Add product", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Browser lamp", exact: false })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Adjust stock for Browser lamp" })
    .click();
  await page.getByLabel("Quantity change (+ or −)", { exact: true }).fill("-2");
  await page.getByLabel("Reason", { exact: true }).fill("Damaged in shipping");
  await page.getByRole("button", { name: "Update stock", exact: true }).click();
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page
    .getByRole("button", { name: "Add customer", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Customer / business name", { exact: true })
    .fill("Browser customer");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("buyer@example.com");
  await page
    .getByLabel("Billing address", { exact: true })
    .fill("12 Test Road");
  await page
    .getByRole("button", { name: "Add customer", exact: true })
    .last()
    .click();
  await waitForText("Browser customer");
  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await makeDraft();
  assert.equal(
    (await pool.query("SELECT stock FROM products")).rows[0].stock,
    8,
  );
  await page
    .getByRole("button", { name: "Issue invoice", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Mark paid", exact: true }).waitFor();
  assert.equal(
    (await pool.query("SELECT stock FROM products")).rows[0].stock,
    6,
  );
  assert.equal(
    Number(
      (await pool.query("SELECT total_cents FROM invoices")).rows[0]
        .total_cents,
    ),
    23602,
  );
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator("#print-invoice").isVisible(), true);
  assert.equal(await page.locator(".main-shell").isVisible(), false);
  await page.pdf({ path: "/tmp/luxora-test-invoice.pdf", format: "A4" });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Mark paid", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await waitForText("Payment recorded.");
  await closeInvoice();
  await page.reload();
  await page.getByRole("button", { name: "INV-1001", exact: true }).waitFor();
  assert.equal(
    (await pool.query("SELECT status FROM invoices")).rows[0].status,
    "paid",
  );
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search name, SKU…" })
    .fill("no matching product");
  await waitForText("No products found");
  await page.getByRole("button", { name: "Clear search" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "luxora-inventory.csv");
  assert.deepEqual(errors, []);
});
test("mobile layout has no page overflow; navigation and keyboard modal controls work", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await waitForText("Recent invoices");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page
    .getByRole("button", { name: "Add product", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.screenshot({
    path: "/tmp/luxora-test-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
});
