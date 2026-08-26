import { describe, it, expect } from "vitest";
import { loader as liveLoader } from "../../app/routes/api.health.live";
import { loader as readyLoader } from "../../app/routes/api.health.ready";

interface LiveHealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

interface ReadyHealthResponse {
  status: string;
  database: string;
  latencyMs: number;
  hasVectorExtension: boolean;
  uptime: number;
  timestamp: string;
  error?: string;
}

describe("Health API Routes", () => {
  it("GET /api/health/live returns live status and timestamp", async () => {
    const response = await liveLoader();
    expect(response.status).toBe(200);
    const body = (await response.json()) as LiveHealthResponse;
    expect(body.status).toBe("live");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it("GET /api/health/ready returns ready status and live database health", async () => {
    const response = await readyLoader();
    expect(response.status).toBe(200);
    const body = (await response.json()) as ReadyHealthResponse;
    expect(body.status).toBe("ready");
    expect(body.database).toBe("healthy");
    expect(typeof body.latencyMs).toBe("number");
    expect(body.hasVectorExtension).toBe(true);
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });
});
