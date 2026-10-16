import { readFile } from "node:fs/promises";
import { pool, transaction } from "./db.js";
export async function migrate() {
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(781628)");
    await client.query(sql);
  });
}
if (process.argv[1]?.endsWith("/migrate.js")) {
  try {
    await migrate();
    console.log("Database schema is up to date.");
  } finally {
    await pool.end();
  }
}
