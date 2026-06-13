/**
 * Notification Worker
 *
 * Inserts notification rows into the DB for every queued event.
 * All notification types flow through here — webhook confirmations,
 * bonus events, VIP upgrades, scheduled expiry warnings.
 */

import { Worker, type Job } from "bullmq";
import { nanoid } from "nanoid";
import { db } from "@/drizzle";
import { notification } from "@/drizzle/schema";
import { bullmqConnection, type NotificationJobData } from "@/lib/queue";

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    "notification",
    async (job: Job<NotificationJobData>) => {
      const { userId, type, title, body, metadata } = job.data;

      await db.insert(notification).values({
        id: nanoid(),
        userId,
        type,
        title,
        body,
        metadata: metadata ?? undefined,
        createdAt: new Date(),
      });

      console.log(`[worker:notification] ${type} → user ${userId}`);
    },
    {
      connection: bullmqConnection,
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker:notification] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
