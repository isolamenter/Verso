import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool, checkDatabaseHealth } from "../server/db/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  console.log("[Verso Migration] Checking database connectivity...");
  const health = await checkDatabaseHealth();
  if (health.status !== "healthy") {
    console.error("[Verso Migration] Database is not available:", health.error);
    throw new Error(`Database connection failed: ${health.error}`);
  }

  const migrationsFolder = path.resolve(__dirname, "../drizzle");
  console.log(`[Verso Migration] Applying migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  console.log("[Verso Migration] Migrations applied successfully.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("[Verso Migration] Migration failed:", err);
      await pool.end();
      process.exit(1);
    });
}

