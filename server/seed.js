import { migrate } from "./migrate.js";
import { pool, transaction } from "./db.js";
await migrate();
try {
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(781629)");
    if (
      Number((await c.query("SELECT count(*) FROM products")).rows[0].count) > 0
    ) {
      console.log("Existing inventory found; demo seed skipped.");
      return;
    }
    const products = [
      ["Arc table lamp", "LX-001", "Lighting", 249900, 135000, 38, 10],
      ["Forma lounge chair", "LX-002", "Furniture", 1299900, 780000, 12, 5],
      ["Terra ceramic vase", "LX-003", "Decor", 189900, 95000, 7, 10],
      ["Linen cushion cover", "LX-004", "Textiles", 89900, 40000, 64, 15],
      ["Oak side table", "LX-005", "Furniture", 649900, 380000, 4, 5],
      ["Ripple glass set", "LX-006", "Kitchen", 159900, 80000, 28, 8],
      ["Woven storage basket", "LX-007", "Decor", 129900, 65000, 0, 8],
      ["Everyday cotton throw", "LX-008", "Textiles", 219900, 110000, 21, 10],
    ];
    const ids = [];
    for (const p of products) {
      const { rows } = await c.query(
        "INSERT INTO products(name,sku,category,price_cents,cost_cents,stock,reorder_level) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
        p,
      );
      ids.push(rows[0].id);
      if (p[5])
        await c.query(
          "INSERT INTO stock_movements(product_id,quantity,reason) VALUES($1,$2,$3)",
          [rows[0].id, p[5], "Opening stock · demo inventory"],
        );
    }
    const customers = [];
    for (const p of [
      [
        "Studio North",
        "hello@studionorth.example",
        "+91 98765 43210",
        "42 Residency Road, Bengaluru",
        "",
      ],
      [
        "The Good Space",
        "accounts@goodspace.example",
        "+91 98765 43211",
        "18 MG Road, Pune",
        "",
      ],
      [
        "Mira Interiors",
        "mira@example.com",
        "+91 98765 43212",
        "7 Park Street, Kolkata",
        "",
      ],
      [
        "Oak & Co.",
        "hello@oakco.example",
        "",
        "12 Church Street, Bengaluru",
        "",
      ],
    ])
      customers.push(
        (
          await c.query(
            "INSERT INTO customers(name,email,phone,address,tax_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
            p,
          )
        ).rows[0],
      );
    const business = (await c.query("SELECT * FROM settings WHERE id=1"))
      .rows[0];
    for (let m = 5; m >= 0; m--) {
      const customer = customers[m % customers.length];
      const p = products[m % products.length];
      const qty = 2 + (m % 3);
      const sub = p[3] * qty;
      const tax = Math.round(sub * 0.18);
      const paid = m !== 1;
      const { rows } = await c.query(
        `INSERT INTO invoices(customer_id,customer_snapshot,business_snapshot,status,issue_date,due_date,tax_bps,subtotal_cents,tax_cents,total_cents,notes,paid_at,created_at) VALUES($1,$2,$3,$4,CURRENT_DATE-($5*30),CURRENT_DATE-($5*30)+14,1800,$6,$7,$8,'Sample invoice · demo data',CASE WHEN $4='paid' THEN now()-make_interval(months=>$5) ELSE NULL END,now()-make_interval(months=>$5)) RETURNING id,number`,
        [
          customer.id,
          customer,
          business,
          paid ? "paid" : "issued",
          m,
          sub,
          tax,
          sub + tax,
        ],
      );
      await c.query(
        "INSERT INTO invoice_items(invoice_id,product_id,name,sku,quantity,price_cents,line_total_cents) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [rows[0].id, ids[m % products.length], p[0], p[1], qty, p[3], sub],
      );
      await c.query("UPDATE products SET stock=stock-$1 WHERE id=$2", [
        qty,
        ids[m % products.length],
      ]);
      await c.query(
        "INSERT INTO stock_movements(product_id,invoice_id,quantity,reason,created_at) VALUES($1,$2,$3,$4,now()-make_interval(months=>$5))",
        [
          ids[m % products.length],
          rows[0].id,
          -qty,
          `Invoice issued · ${rows[0].number}`,
          m,
        ],
      );
    }
    console.log("Demo data added: 8 products, 4 customers, 6 invoices.");
  });
} finally {
  await pool.end();
}
