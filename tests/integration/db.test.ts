import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, pool, checkDatabaseHealth } from "../../server/db/client";
import { systemMetadata } from "../../server/db/schema";
import { eq } from "drizzle-orm";

describe("Database and pgvector Integration", () => {
  beforeAll(async () => {
    const health = await checkDatabaseHealth();
    expect(health.status).toBe("healthy");
  });

  afterAll(async () => {
    // Clean up sentinel records
    try {
      await db.delete(systemMetadata).where(eq(systemMetadata.key, "test_sentinel"));
    } catch {
      // ignore
    }
  });

  it("asserts PostgreSQL connection and health check reporting", async () => {
    const health = await checkDatabaseHealth();
    expect(health.status).toBe("healthy");
    expect(typeof health.latencyMs).toBe("number");
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.hasVectorExtension).toBe(true);
  });

  it("asserts vector extension is enabled and can perform vector operations", async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector as distance;
      `);
      expect(result.rows.length).toBe(1);
      expect(Number(result.rows[0].distance)).toBeCloseTo(1.0, 4);
    } finally {
      client.release();
    }
  });

  it("performs CRUD on system_metadata table (sentinel record test)", async () => {
    const sentinelKey = "test_sentinel";
    const sentinelVal = "initialized_at_" + Date.now();

    // 1. Insert
    await db
      .insert(systemMetadata)
      .values({ key: sentinelKey, value: sentinelVal })
      .onConflictDoUpdate({
        target: systemMetadata.key,
        set: { value: sentinelVal, updatedAt: new Date() },
      });

    // 2. Select
    const rows = await db
      .select()
      .from(systemMetadata)
      .where(eq(systemMetadata.key, sentinelKey));

    expect(rows.length).toBe(1);
    expect(rows[0].key).toBe(sentinelKey);
    expect(rows[0].value).toBe(sentinelVal);

    // 3. Update
    const updatedVal = "updated_val_" + Date.now();
    await db
      .update(systemMetadata)
      .set({ value: updatedVal, updatedAt: new Date() })
      .where(eq(systemMetadata.key, sentinelKey));

    const updatedRows = await db
      .select()
      .from(systemMetadata)
      .where(eq(systemMetadata.key, sentinelKey));

    expect(updatedRows.length).toBe(1);
    expect(updatedRows[0].value).toBe(updatedVal);

    // 4. Delete
    await db.delete(systemMetadata).where(eq(systemMetadata.key, sentinelKey));
    const finalRows = await db
      .select()
      .from(systemMetadata)
      .where(eq(systemMetadata.key, sentinelKey));

    expect(finalRows.length).toBe(0);
  });
});

