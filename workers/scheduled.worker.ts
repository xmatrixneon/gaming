/**
 * Scheduled Worker
 *
 * Registers repeating maintenance jobs and processes them.
 * All jobs are idempotent — safe to re-run if they overlap.
 *
 * Schedule:
 *   bonus_expiry_check      — every hour      (expire overdue bonuses, notify users)
 *   bonus_expiry_warning    — every hour      (warn users 24 h before expiry)
 *   deposit_timeout_check   — every 15 min    (mark stale pending deposits failed)
 *   referral_expiry_check   — every 6 hours   (expire pending referrals past deadline)
 *   game_session_cleanup    — every hour      (end stale active sessions > 2 h old)
 */

import { Worker, type Job } from "bullmq";
import { lt, inArray, and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/drizzle";
import { userBonus, deposit, referral, gameSession, notification } from "@/drizzle/schema";
import { nanoid } from "nanoid";
import {
  bullmqConnection,
  scheduledQueue,
  type ScheduledJobData,
  enqueueNotification,
} from "@/lib/queue";

// ── Job processors ────────────────────────────────────────────────────────────

async function runBonusExpiryCheck(): Promise<void> {
  const now = new Date();

  // Find all active/pending bonuses that have passed their expiry date
  const expired = await db
    .select({ id: userBonus.id, userId: userBonus.userId, awardedAmount: userBonus.awardedAmount })
    .from(userBonus)
    .where(
      and(
        inArray(userBonus.status, ["pending", "active"]),
        lt(userBonus.expiresAt, now),
      ),
    );

  if (expired.length === 0) return;

  // Batch update — expire all at once
  await db
    .update(userBonus)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        inArray(userBonus.status, ["pending", "active"]),
        lt(userBonus.expiresAt, now),
      ),
    );

  // Notify each user
  for (const bonus of expired) {
    await enqueueNotification({
      userId: bonus.userId,
      type: "system",
      title: "Bonus Expired",
      body: "A bonus has expired before completion. Keep playing to earn new bonuses!",
      metadata: { bonusId: bonus.id },
    });
  }

  console.log(`[worker:scheduled] bonus_expiry_check expired ${expired.length} bonuses`);
}

async function runBonusExpiryWarning(): Promise<void> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find bonuses expiring in next 24 hours that are still active
  const expiring = await db
    .select({ id: userBonus.id, userId: userBonus.userId, expiresAt: userBonus.expiresAt })
    .from(userBonus)
    .where(
      and(
        inArray(userBonus.status, ["pending", "active"]),
        gt(userBonus.expiresAt, now),    // not yet expired
        lt(userBonus.expiresAt, in24h), // expires within 24 h
      ),
    );

  if (expiring.length === 0) return;

  for (const bonus of expiring) {
    // Check if we already sent a warning for this bonus (avoid spam on hourly runs)
    const existing = await db
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          eq(notification.userId, bonus.userId),
          eq(notification.type, "bonus_expiring"),
          // Created in the last 23 h — means we already warned this run window
          sql`${notification.createdAt} > NOW() - INTERVAL '23 hours'`,
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    const hoursLeft = Math.round((bonus.expiresAt.getTime() - now.getTime()) / 3_600_000);

    await enqueueNotification({
      userId: bonus.userId,
      type: "bonus_expiring",
      title: "Bonus Expiring Soon",
      body: `Your bonus expires in ~${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}. Complete wagering to claim it!`,
      metadata: { bonusId: bonus.id },
    });
  }

  console.log(`[worker:scheduled] bonus_expiry_warning checked ${expiring.length} bonuses`);
}

async function runDepositTimeoutCheck(): Promise<void> {
  // Deposits pending for more than 30 minutes are considered timed out
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);

  const stale = await db
    .select({ id: deposit.id })
    .from(deposit)
    .where(and(eq(deposit.status, "pending"), lt(deposit.createdAt, cutoff)));

  if (stale.length === 0) return;

  await db
    .update(deposit)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(deposit.status, "pending"), lt(deposit.createdAt, cutoff)));

  console.log(`[worker:scheduled] deposit_timeout_check expired ${stale.length} deposits`);
}

async function runReferralExpiryCheck(): Promise<void> {
  const now = new Date();

  const expired = await db
    .select({ id: referral.id })
    .from(referral)
    .where(and(eq(referral.status, "pending"), lt(referral.qualifyByDate, now)));

  if (expired.length === 0) return;

  await db
    .update(referral)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(referral.status, "pending"), lt(referral.qualifyByDate, now)));

  console.log(`[worker:scheduled] referral_expiry_check expired ${expired.length} referrals`);
}

async function runGameSessionCleanup(): Promise<void> {
  // Sessions active for more than 2 hours with no end time are stale
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const stale = await db
    .select({ id: gameSession.id })
    .from(gameSession)
    .where(and(eq(gameSession.status, "active"), lt(gameSession.startedAt, cutoff)));

  if (stale.length === 0) return;

  await db
    .update(gameSession)
    .set({ status: "completed", endedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(gameSession.status, "active"), lt(gameSession.startedAt, cutoff)));

  console.log(`[worker:scheduled] game_session_cleanup ended ${stale.length} stale sessions`);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

async function processScheduledJob(job: Job<ScheduledJobData>): Promise<void> {
  console.log(`[worker:scheduled] running ${job.data.kind}`);

  switch (job.data.kind) {
    case "bonus_expiry_check":
      return runBonusExpiryCheck();
    case "bonus_expiry_warning":
      return runBonusExpiryWarning();
    case "deposit_timeout_check":
      return runDepositTimeoutCheck();
    case "referral_expiry_check":
      return runReferralExpiryCheck();
    case "game_session_cleanup":
      return runGameSessionCleanup();
    default: {
      const exhaustive: never = job.data;
      throw new Error(`Unknown scheduled job: ${JSON.stringify(exhaustive)}`);
    }
  }
}

// ── Worker factory ────────────────────────────────────────────────────────────

export function createScheduledWorker(): Worker<ScheduledJobData> {
  const worker = new Worker<ScheduledJobData>(
    "scheduled",
    processScheduledJob,
    {
      connection: bullmqConnection,
      concurrency: 1, // scheduled jobs run one at a time to avoid thundering herd
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker:scheduled] ${job?.data?.kind} failed:`, err.message);
  });

  return worker;
}

// ── Schedule registration ─────────────────────────────────────────────────────

/** Call once at worker startup to register all repeating jobs. */
export async function setupScheduledJobs(): Promise<void> {
  const jobs: Array<{ name: ScheduledJobData["kind"]; everyMs: number }> = [
    { name: "bonus_expiry_check",    everyMs: 60 * 60 * 1000 },       // 1 hour
    { name: "bonus_expiry_warning",  everyMs: 60 * 60 * 1000 },       // 1 hour
    { name: "deposit_timeout_check", everyMs: 15 * 60 * 1000 },       // 15 min
    { name: "referral_expiry_check", everyMs: 6 * 60 * 60 * 1000 },   // 6 hours
    { name: "game_session_cleanup",  everyMs: 60 * 60 * 1000 },       // 1 hour
  ];

  for (const { name, everyMs } of jobs) {
    await scheduledQueue.add(
      name,
      { kind: name } as ScheduledJobData,
      {
        jobId: `scheduled:${name}`,  // stable ID prevents duplicates on restart
        repeat: { every: everyMs },
      },
    );
    console.log(`[scheduler] registered ${name} every ${everyMs / 60000} min`);
  }
}
