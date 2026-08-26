import { checkDatabaseHealth } from "../../server/db/client";

export async function loader() {
  const dbHealth = await checkDatabaseHealth();
  const isHealthy = dbHealth.status === "healthy";

  const payload = {
    status: isHealthy ? "ready" : "unhealthy",
    database: dbHealth.status,
    latencyMs: dbHealth.latencyMs,
    hasVectorExtension: dbHealth.hasVectorExtension,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    ...(dbHealth.error ? { error: dbHealth.error } : {}),
  };

  return Response.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
