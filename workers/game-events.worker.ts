/**
 * Game Events Worker
 *
 * Processes non-critical bet side effects with retry semantics.
 * These were previously inline try/catch in aggregator-adapter.debit() —
 * moving them here means a transient DB failure gets retried instead of silently lost.
 *
 * Failures here NEVER affect the bet itself — the bet transaction is already committed
 * when these jobs are enqueued.
 */

import { Worker, type Job } from "bullmq";
import { bullmqConnection, type GameEventJobData } from "@/lib/queue";
import { bonusService } from "@/lib/bonus-service";
import { vipService } from "@/lib/vip-service";

async function processGameEvent(job: Job<GameEventJobData>): Promise<void> {
  const data = job.data;

  if (data.kind === "bonus_wagering") {
    const betAmount = BigInt(data.betAmountPaisa);
    await bonusService.trackWagering(data.userId, betAmount);
    return;
  }

  if (data.kind === "vip_progress") {
    const betAmount = BigInt(data.betAmountPaisa);
    await vipService.trackProgress(data.userId, betAmount);
    return;
  }

  throw new Error(`Unknown game event kind: ${(data as GameEventJobData).kind}`);
}

export function createGameEventsWorker(): Worker<GameEventJobData> {
  const worker = new Worker<GameEventJobData>(
    "game-events",
    processGameEvent,
    {
      connection: bullmqConnection,
      concurrency: 20, // high concurrency — these are cheap reads + small writes
    },
  );

  worker.on("failed", (job, err) => {
    // Log but never alert on-call — these are non-critical side effects
    console.error(
      `[worker:game-events] ${job?.data?.kind} failed for user ${job?.data?.userId}:`,
      err.message,
    );
  });

  return worker;
}
