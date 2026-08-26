import compression from "compression";
import express from "express";
import morgan from "morgan";
import { createRequestHandler } from "@react-router/express";
import { env } from "./config/env";
import { originGuard } from "./security/originGuard";
import { closeDatabasePool } from "./db/client";

const app = express();

app.use(compression());
app.disable("x-powered-by");

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("short"));
}

// Security: reject cross-origin state-changing requests
app.use(originGuard);

// Serve client static assets
app.use(
  "/assets",
  express.static("build/client/assets", {
    immutable: true,
    maxAge: "1y",
  })
);

app.use(
  express.static("build/client", {
    maxAge: "1h",
  })
);

// React Router SSR and API routes handler
app.use(
  createRequestHandler({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    build: () => import("../build/server/index.js" as any) as any,
  })
);

const host = env.VERSO_HOST;
const port = env.VERSO_PORT;

const server = app.listen(port, host, () => {
  console.log(`[Verso Server] Listening on http://${host}:${port}`);
});

async function handleShutdown(signal: string) {
  console.log(`\n[Verso Server] Received ${signal}, closing server...`);
  server.close(async () => {
    console.log("[Verso Server] HTTP server closed.");
    await closeDatabasePool();
    console.log("[Verso Server] Server closed cleanly.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
