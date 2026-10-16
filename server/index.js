import { app } from "./app.js";
import { migrate } from "./migrate.js";
import { pool } from "./db.js";
try {
  await migrate();
  const server = app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
    console.log(`Luxora API listening on port ${process.env.PORT || 3001}`),
  );
  const stop = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (error) {
  console.error("Startup failed:", error.message);
  await pool.end();
  process.exit(1);
}
