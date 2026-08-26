import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.VERSO_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export interface DatabaseHealth {
  status: "healthy" | "unhealthy" | "pending";
  latencyMs?: number;
  hasVectorExtension?: boolean;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          1 as live,
          EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as has_vector
      `);
      const latencyMs = Date.now() - start;
      const hasVectorExtension = Boolean(result.rows[0]?.has_vector);

      return {
        status: "healthy",
        latencyMs,
        hasVectorExtension,
      };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    console.log("[Verso DB] Connection pool closed cleanly.");
  } catch (err) {
    console.error("[Verso DB] Error closing pool:", err);
  }
}

