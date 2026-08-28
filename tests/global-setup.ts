import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setup() {
  const adminConnectionString = "postgres://verso:verso_dev_secret@127.0.0.1:5432/postgres";
  const testDbName = "verso_test";
  const testDbUrl = `postgres://verso:verso_dev_secret@127.0.0.1:5432/${testDbName}`;

  // 1. Ensure test database exists
  const adminClient = new pg.Client({ connectionString: adminConnectionString });
  try {
    await adminClient.connect();
    const res = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [testDbName]);
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${testDbName}`);
      console.log(`[Vitest Global Setup] Created test database: ${testDbName}`);
    }
  } catch (err) {
    console.warn("[Vitest Global Setup] Admin client DB check:", err);
  } finally {
    await adminClient.end().catch(() => {});
  }

  // 2. Ensure vector extension
  const testClient = new pg.Client({ connectionString: testDbUrl });
  try {
    await testClient.connect();
    await testClient.query("CREATE EXTENSION IF NOT EXISTS vector");
  } catch (err) {
    console.warn("[Vitest Global Setup] Vector extension error:", err);
  } finally {
    await testClient.end().catch(() => {});
  }

  // 3. Apply migrations to test DB
  const pool = new pg.Pool({ connectionString: testDbUrl, max: 1 });
  try {
    const db = drizzle(pool);
    const migrationsFolder = path.resolve(__dirname, "../drizzle");
    await migrate(db, { migrationsFolder });
  } catch (err) {
    console.warn("[Vitest Global Setup] Migration error on test DB:", err);
  } finally {
    await pool.end().catch(() => {});
  }
}

