/**
 * BullMQ Queue Infrastructure
 *
 * Central file for all async job queues. Imported by:
 * - Webhook handlers (to enqueue payment jobs)
 * - aggregator-adapter (to enqueue game event side effects)
 * - workers/ (to create Worker instances)
 *
 * BullMQ requires its own Redis connection with maxRetriesPerRequest: null
 * (it uses blocking commands that conflict with the app's ioredis singleton).
 */

import { Queue, type ConnectionOptions } from "bullmq";

// ── Connection ────────────────────────────────────────────────────────────────

export const bullmqConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB ?? 0),
  // Required for BullMQ — it uses BLPOP which needs persistent connections
  maxRetriesPerRequest: null,
};

// ── Job data types ────────────────────────────────────────────────────────────

/** Notification queue — insert one DB row per job */
export type NotificationJobData = {
  userId: string;
  type:
    | "deposit_confirmed"
    | "withdrawal_approved"
    | "withdrawal_rejected"
    | "withdrawal_processed"
    | "bonus_credited"
    | "bonus_expiring"
    | "referral_joined"
    | "referral_qualified"
    | "bet_settled"
    | "account_flagged"
    | "account_banned"
    | "system";
  title: string;
  body: string;
  metadata?: {
    transactionId?: string;
    withdrawalId?: string;
    depositId?: string;
    betId?: string;
    bonusId?: string;
    referralId?: string;
    actionUrl?: string;
  };
};

/** Payment queue — webhook-confirmed events that need DB writes */
export type PaymentJobData =
  | {
      gateway: "velopay";
      kind: "deposit_success";
      depositId: string;
      userId: string;
      /** Amount in paisa (string to survive JSON serialisation) */
      amountPaisa: string;
      gatewayRef: string;
      utr?: string;
    }
  | {
      gateway: "velopay";
      kind: "deposit_failed";
      depositId: string;
      message?: string;
    }
  | {
      gateway: "velopay";
      kind: "withdrawal_success";
      withdrawalId: string;
      utr?: string;
      gatewayRef?: string;
    }
  | {
      gateway: "velopay";
      kind: "withdrawal_failed";
      withdrawalId: string;
      userId: string;
      /** Decimal string from withdrawal.amount column */
      amountDecimal: string;
      message?: string;
    }
  | {
      gateway: "okpay";
      kind: "deposit_success";
      depositId: string;
      userId: string;
      amountPaisa: string;
      transactionRef: string;
    }
  | {
      gateway: "okpay";
      kind: "deposit_failed";
      depositId: string;
    }
  | {
      gateway: "okpay";
      kind: "withdrawal_success";
      withdrawalId: string;
      gatewayRef: string;
    }
  | {
      gateway: "okpay";
      kind: "withdrawal_failed";
      withdrawalId: string;
      userId: string;
      amountDecimal: string;
    };

/** Game events queue — non-critical bet side effects */
export type GameEventJobData =
  | {
      kind: "bonus_wagering";
      userId: string;
      /** Bet amount in paisa (string) */
      betAmountPaisa: string;
    }
  | {
      kind: "vip_progress";
      userId: string;
      betAmountPaisa: string;
    };

/** Scheduled queue — recurring maintenance jobs */
export type ScheduledJobData =
  | { kind: "bonus_expiry_check" }
  | { kind: "deposit_timeout_check" }
  | { kind: "referral_expiry_check" }
  | { kind: "game_session_cleanup" }
  | { kind: "bonus_expiry_warning" };

// ── Queue instances ───────────────────────────────────────────────────────────

export const notificationQueue = new Queue<NotificationJobData>("notification", {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 3600 },   // keep 1 h for debugging
    removeOnFail: { age: 86400 },      // keep 24 h for post-mortem
  },
});

export const paymentQueue = new Queue<PaymentJobData>("payment", {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 10,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 * 7 }, // keep 7 d — financial audit trail
  },
});

export const gameEventsQueue = new Queue<GameEventJobData>("game-events", {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export const scheduledQueue = new Queue<ScheduledJobData>("scheduled", {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: { age: 86400 },
  },
});

// ── Type-safe enqueuer helpers ────────────────────────────────────────────────

/** Enqueue a notification for a user. Fire-and-forget safe. */
export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  await notificationQueue.add(`${data.type}:${data.userId}`, data);
}

/** Enqueue a payment webhook event for async processing. */
export async function enqueuePaymentJob(
  data: PaymentJobData,
  /** Stable job ID — BullMQ deduplicates if a job with same ID already exists */
  jobId: string,
): Promise<void> {
  await paymentQueue.add(`${data.gateway}:${data.kind}`, data, { jobId });
}

/** Enqueue game event side effects (bonus wagering, VIP progress). */
export async function enqueueGameEvent(data: GameEventJobData): Promise<void> {
  await gameEventsQueue.add(data.kind, data);
}
