/**
 * Worker Process Entrypoint
 *
 * Run as a separate process alongside Next.js:
 *   npx tsx workers/index.ts
 *
 * Starts all BullMQ workers and registers scheduled repeat jobs.
 * Handles graceful shutdown on SIGTERM/SIGINT (e.g. from Docker/PM2).
 *
 * In production, run via PM2 or a Dockerfile CMD:
 *   pm2 start "npx tsx workers/index.ts" --name clausbet-workers
 */

import { createNotificationWorker } from "./notification.worker";
import { createPaymentWorker } from "./payment.worker";
import { createGameEventsWorker } from "./game-events.worker";
import { createScheduledWorker, setupScheduledJobs } from "./scheduled.worker";

async function main() {
  console.log("[workers] starting all workers…");

  const workers = [
    createNotificationWorker(),
    createPaymentWorker(),
    createGameEventsWorker(),
    createScheduledWorker(),
  ];

  await setupScheduledJobs();

  console.log("[workers] all workers running");

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    console.log(`[workers] ${signal} received — draining queues…`);

    // Close all workers (waits for in-flight jobs to complete)
    await Promise.allSettled(workers.map((w) => w.close()));

    console.log("[workers] shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  // Keep the process alive
  process.stdin.resume();
}

main().catch((err) => {
  console.error("[workers] fatal startup error:", err);
  process.exit(1);
});
