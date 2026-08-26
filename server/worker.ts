import { env } from "./config/env";
import { checkDatabaseHealth, closeDatabasePool } from "./db/client";
import { jobRunner } from "./jobs";

export async function runWorker(): Promise<void> {
  console.log("[Verso Worker] Initializing background worker process...");
  console.log(`[Verso Worker] Environment: ${env.NODE_ENV}, Data dir: ${env.VERSO_DATA_DIR}`);

  const health = await checkDatabaseHealth();
  if (health.status !== "healthy") {
    throw new Error(`[Verso Worker] Database is unhealthy: ${health.error}`);
  }

  console.log(
    `[Verso Worker] Database connected successfully (latency: ${health.latencyMs}ms, has_vector: ${health.hasVectorExtension ?? false})`
  );

  await jobRunner.start();
  console.log("[Verso Worker] Background job runner started and ready to process jobs.");

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[Verso Worker] Received ${signal}, gracefully shutting down worker...`);
    try {
      await jobRunner.stop();
      await closeDatabasePool();
      console.log("[Verso Worker] Worker shut down cleanly.");
      process.exit(0);
    } catch (err) {
      console.error("[Verso Worker] Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runWorker().catch((err) => {
    console.error("[Verso Worker] Fatal error running worker:", err);
    process.exit(1);
  });
}

