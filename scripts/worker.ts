import { runWorker } from "../server/worker";

runWorker().catch((err) => {
  console.error("[Verso Worker] Fatal error:", err);
  process.exit(1);
});
