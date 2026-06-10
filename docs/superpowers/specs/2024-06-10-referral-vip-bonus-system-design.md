# Referral, VIP, and Bonus System Design

**Project:** ClausBet Gaming Platform  
**Date:** 2024-06-10  
**Status:** Approved for Implementation  
**Approach:** Acquisition-First MVP (Phased Rollout)

---

## Executive Summary

This design implements a **phased user acquisition system** that prioritizes growth through referrals and welcome bonuses, then builds VIP retention on top. The system is divided into 4 phases, each delivering independent value:

- **Phase 1 (Week 1-2):** Core Referral System - 10% referral bonus (max ₹2,000)
- **Phase 2 (Week 3):** Welcome Bonus - 100% deposit match with 20x wagering
- **Phase 3 (Week 4-5):** VIP Foundation - 5-tier system based on total wagered
- **Phase 4 (Week 6+):** Advanced VIP - Tier-exclusive bonuses and admin tools

**Business Goals:**
- Drive user acquisition through aggressive referral incentives
- Convert signups into depositors with compelling welcome bonus
- Retain acquired users with VIP progression and exclusive bonuses
- Protect against fraud with multi-layer abuse prevention

---

## Table of Contents

1. [Requirements](#requirements)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Referral System](#phase-1-referral-system)
4. [Phase 2: Welcome Bonus](#phase-2-welcome-bonus)
5. [Phase 3: VIP Foundation](#phase-3-vip-foundation)
6. [Phase 4: Advanced VIP](#phase-4-advanced-vip)
7. [Data Flows](#data-flows)
8. [Error Handling](#error-handling)
9. [Testing Strategy](#testing-strategy)
10. [Migration Plan](#migration-plan)
11. [Security Considerations](#security-considerations)

---

## Requirements

### Functional Requirements

**FR-1: Referral Code Generation**
- Each user shall be assigned a unique 12-character alphanumeric referral code
- Referral codes shall be case-insensitive for entry but stored in uppercase
- Codes shall be unique across the system with enforced database constraint

**FR-2: Referral Tracking**
- When a new user signs up with a referral code, a referral record shall be created
- Referral status shall progress: pending → qualified → rewarded
- Referral shall qualify when referred user makes their first deposit
- Referral bonus shall be 10% of referred user's first deposit amount
- Referral bonus shall be capped at maximum ₹2,000

**FR-3: Welcome Bonus**
- First-time depositors shall be eligible for 100% deposit match bonus
- Welcome bonus shall be capped at maximum ₹10,000
- Bonus shall be subject to 20x wagering requirement before withdrawal
- Bonus shall expire after 30 days if wagering not completed
- User shall have only one welcome bonus claim per account

**FR-4: VIP Tier System**
- Users shall progress through 5 VIP tiers: Bronze → Silver → Gold → Platinum → Diamond
- Tier progression shall be based on total lifetime amount wagered
- VIP tiers shall never downgrade (once Diamond, always Diamond)
- Higher tiers shall receive better bonus multipliers on all bonuses

**FR-5: Wagering Tracking**
- All bets shall contribute to wagering requirements for active bonuses
- Wagering shall be tracked separately for each active bonus
- When wagering requirement is met, bonus amount shall convert to withdrawable balance
- Bonuses shall be forfeited if user withdraws before meeting wagering requirements

### Non-Functional Requirements

**NFR-1: Performance**
- Referral code validation shall complete within 100ms
- Bonus wagering updates shall not delay bet settlement
- VIP tier calculation shall be asynchronous and not block user actions

**NFR-2: Scalability**
- System shall handle 10,000 concurrent users without degradation
- Database queries shall use proper indexes for all hot paths
- Redis caching shall be used for frequently accessed data

**NFR-3: Security**
- All financial operations shall use atomic transactions with optimistic locking
- Self-referral shall be prevented through IP and email validation
- Bonus abuse shall be prevented through velocity checks and pattern detection

**NFR-4: Auditability**
- All bonus transactions shall be recorded in immutable transaction ledger
- All referral status changes shall be logged with timestamps
- VIP tier changes shall trigger audit log entries

---

## Architecture Overview

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Deposit  │  │  Referral│  │   VIP    │  │  Bonus   │  │
│  │   UI     │  │   UI     │  │   UI     │  │   UI     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  tRPC API Layer    │
                    │  (Next.js API)     │
                    └─────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼───────┐  ┌────────▼────────┐
│ Referral       │  │ Bonus Service   │  │ VIP Service     │
│ Service        │  │                 │  │                 │
└───────┬────────┘  └────────┬───────┘  └────────┬────────┘
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Postgres DB      │
                    │   + Redis Cache    │
                    └────────────────────┘
```

### Database Schema Utilization

The system leverages existing schema tables defined in `drizzle/schema.ts`:

- **`user`** - Extended with `referralCode` column for referral codes
- **`referral`** - Tracks referrer-referred relationships with status
- **`bonusTemplate`** - Defines reusable bonus configurations
- **`userBonus`** - Per-user bonus claims with wagering progress
- **`gameStats`** - Tracks total wagered for VIP tier calculation
- **`notification`** - User notifications for bonus/VIP events
- **`auditLog`** - Compliance audit trail for all operations

---

## Phase 1: Referral System

### Overview

The referral system enables users to generate unique referral codes and earn bonuses when friends they refer make their first deposit.

**Timeline:** Week 1-2  
**Priority:** Critical (Core acquisition channel)

### Components

#### 1.1 Referral Code Generation

**Implementation:**
```typescript
// In auth router - during signup
import { nanoid } from 'nanoid';

async function generateReferralCode(): Promise<string> {
  let code: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = nanoid(12).toUpperCase();
    const existing = await db.query.user.findFirst({
      where: eq(user.referralCode, code)
    });
    if (!existing) return code;
    attempts++;
  } while (attempts < maxAttempts);

  throw new Error('Failed to generate unique referral code');
}

// Create user with referral code
await db.insert(user).values({
  id: userId,
  email,
  username,
  referralCode: await generateReferralCode(),
  // ... other fields
});
```

**Validation:**
- 12 characters, alphanumeric only, uppercase
- Unique constraint enforced at database level
- Generated on signup, stored in `user.referralCode`

#### 1.2 Referral Tracking

**Status Flow:**
```
pending → qualified → rewarded
            ↓
         expired (after 7 days)
            ↓
       cancelled (fraud detected)
```

**Database Operations:**

```typescript
// On user signup with referral code
async function handleReferralOnSignup(
  referredUserId: string,
  referralCode: string,
  ipAddress: string,
  email: string
): Promise<void> {
  // Validate referral code exists
  const referrer = await db.query.user.findFirst({
    where: eq(user.referralCode, referralCode)
  });

  if (!referrer) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid referral code'
    });
  }

  // Self-referral detection: IP check
  const referrerSession = await db.query.session.findFirst({
    where: eq(session.userId, referrer.id),
    orderBy: desc(session.createdAt)
  });

  if (referrerSession?.ipAddress === ipAddress) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot use your own referral code'
    });
  }

  // Self-referral detection: Email similarity
  if (sanitizeEmail(referrer.email) === sanitizeEmail(email)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Cannot refer yourself'
    });
  }

  // Create referral record
  await db.insert(referral).values({
    id: nanoid(),
    referrerId: referrer.id,
    referredUserId,
    referralCode,
    status: 'pending',
    qualifyByDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

**On First Deposit (Qualify Referral):**
```typescript
async function qualifyReferral(userId: string, depositAmount: bigint, depositId: string): Promise<void> {
  // Find pending referral for this user
  const pendingReferral = await db.query.referral.findFirst({
    where: and(
      eq(referral.referredUserId, userId),
      eq(referral.status, 'pending')
    )
  });

  if (!pendingReferral) return; // No pending referral

  // Calculate bonus: 10% of deposit, max ₹2,000
  const bonusAmount = Math.min(
    (depositAmount * 10n) / 100n,
    200000n // ₹2,000 in smallest currency unit (₹2,000.00)
  );

  // Update referral status to qualified
  await db.update(referral)
    .set({
      status: 'qualified',
      qualifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(referral.id, pendingReferral.id));

  // Credit referrer balance
  const result = await walletService.updateBalanceAtomic(
    pendingReferral.referrerId,
    bonusAmount,
    'bonus',
    {
      referralId: pendingReferral.id,
      type: 'referral',
      depositId,
    }
  );

  if (!result.success) {
    console.error('[REFERRAL] Failed to credit bonus:', result.error);
    // Retry logic or manual review queue
    return;
  }

  // Update referral status to rewarded
  await db.update(referral)
    .set({
      status: 'rewarded',
      rewardedAt: new Date(),
      bonusTransactionId: result.transactionId,
      updatedAt: new Date(),
    })
    .where(eq(referral.id, pendingReferral.id));

  // Notify referrer
  await db.insert(notification).values({
    id: nanoid(),
    userId: pendingReferral.referrerId,
    type: 'referral_qualified',
    title: '🎉 Referral Bonus Earned!',
    body: `Your friend deposited and you earned ₹${(Number(bonusAmount) / 100).toFixed(2)}!`,
    metadata: {
      referralId: pendingReferral.id,
      bonusAmount: bonusAmount.toString(),
    },
    createdAt: new Date(),
  });
}
```

#### 1.3 API Endpoints

**Referral Router (`server/routers/referral.ts`):**
```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { eq, desc, and, count } from 'drizzle-orm';
import { db } from '@/drizzle';
import { user, referral, notification } from '@/drizzle/schema';

export const referralRouter = router({
  /**
   * Get current user's referral code
   */
  getReferralCode: protectedProcedure
    .query(async ({ ctx }) => {
      const userData = await db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { referralCode: true }
      });

      return {
        referralCode: userData?.referralCode || null,
        shareLink: userData?.referralCode 
          ? `${process.env.NEXT_PUBLIC_APP_URL}/signup?ref=${userData.referralCode}`
          : null,
      };
    }),

  /**
   * Get referral statistics
   */
  getReferralStats: protectedProcedure
    .query(async ({ ctx }) => {
      const stats = await db.select({
        status: referral.status,
        count: count(),
      })
      .from(referral)
      .where(eq(referral.referrerId, ctx.user.id))
      .groupBy(referral.status);

      const totalEarnings = await db.select({
        total: sql<number>`sum(transaction.amount)`,
      })
      .from(transaction)
      .innerJoin(referral, eq(transaction.metadata->>'referralId', referral.id))
      .where(
        and(
          eq(referral.referrerId, ctx.user.id),
          eq(referral.status, 'rewarded')
        )
      );

      return {
        pending: stats.find(s => s.status === 'pending')?.count || 0,
        qualified: stats.find(s => s.status === 'qualified')?.count || 0,
        rewarded: stats.find(s => s.status === 'rewarded')?.count || 0,
        totalEarnings: totalEarnings[0]?.total || '0',
      };
    }),

  /**
   * Get referral history
   */
  getReferralHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const referrals = await db.query.referral.findMany({
        where: eq(referral.referrerId, ctx.user.id),
        with: {
          referredUser: {
            columns: {
              id: true,
              username: true,
              email: true,
              createdAt: true,
            }
          }
        },
        orderBy: [desc(referral.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return referrals;
    }),
});
```

#### 1.4 Fraud Prevention

**Self-Referral Detection:**
- IP address matching on signup
- Email sanitization (catch `user+ref1@example.com` variations)
- Browser fingerprint matching (optional enhancement)

**Duplicate Prevention:**
- `referredUserId` is unique in schema (one referrer per new user)
- First referral code used is permanently locked in

**Time Window:**
- Referral expires after 7 days if no qualifying deposit
- Automated cron job expires stale referrals

**Maximum Cap:**
- ₹2,000 maximum per referral prevents large-scale abuse
- Caps are enforced at bonus calculation time

#### 1.5 Migration Required

```sql
-- Add referral code column to user table
ALTER TABLE "user" ADD COLUMN "referral_code" varchar(12) UNIQUE;

-- Create index for fast lookups
CREATE INDEX "user_referralCode_idx" ON "user"("referral_code");
```

**Drizzle Migration:**
```typescript
// drizzle/migrations/YYYYMMDDHHMMSS_add_referral_code.ts
import { sql } from 'drizzle-orm';
import { migration } from 'drizzle-orm/postgres';

export async function up(db: any) {
  await db.schema
    .alterTable('user')
    .addColumn('referralCode', 'varchar(12)', (col) => 
      col.notNull().default('').unique()
    )
    .execute();
}

export async function down(db: any) {
  await db.schema
    .alterTable('user')
    .dropColumn('referralCode')
    .execute();
}
```

---

## Phase 2: Welcome Bonus

### Overview

The welcome bonus incentivizes first-time deposits with a 100% match bonus, subject to wagering requirements.

**Timeline:** Week 3  
**Priority:** High (Conversion optimization)

### Components

#### 2.1 Bonus Template Setup

**Seed Data:**
```typescript
// In seed script or migration
await db.insert(bonusTemplate).values({
  id: 'welcome-bonus-100',
  name: 'Welcome Bonus 100% Match',
  description: 'Get 100% bonus on your first deposit up to ₹10,000',
  type: 'welcome',
  value: '100', // 100% match
  maxValue: '100000', // Max ₹10,000 bonus (in paisa: ₹10,000.00)
  wageringMultiplier: '20', // 20x wagering requirement
  expiryDays: 30,
  maxClaimsPerUser: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

#### 2.2 Welcome Bonus Award Logic

**On First Deposit Confirmation:**
```typescript
async function awardWelcomeBonus(userId: string, depositAmount: bigint, depositId: string): Promise<void> {
  // Check if this is user's first completed deposit
  const depositCount = await db.select({ count: sql<number>`count(*)::int` })
    .from(deposit)
    .where(and(
      eq(deposit.userId, userId),
      eq(deposit.status, 'completed')
    ));

  if (depositCount[0].count !== 1) {
    return; // Not first deposit
  }

  // Check if already claimed welcome bonus
  const existingClaim = await db.query.userBonus.findFirst({
    where: and(
      eq(userBonus.userId, userId),
      eq(userBonus.templateId, 'welcome-bonus-100')
    )
  });

  if (existingClaim) {
    return; // Already claimed
  }

  // Get bonus template
  const template = await db.query.bonusTemplate.findFirst({
    where: eq(bonusTemplate.id, 'welcome-bonus-100')
  });

  if (!template || !template.isActive) {
    return; // Template not found or inactive
  }

  // Calculate bonus amount: 100% match, max ₹10,000
  const bonusAmount = Math.min(
    (depositAmount * BigInt(template.value)) / 100n,
    BigInt(template.maxValue || '999999')
  );

  // Calculate wagering requirement
  const wageringRequired = (bonusAmount * BigInt(template.wageringMultiplier)) / 100n;

  // Create user bonus record
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (template.expiryDays || 30));

  await db.insert(userBonus).values({
    id: nanoid(),
    userId,
    templateId: template.id,
    awardedAmount: bonusAmount.toString(),
    status: 'pending',
    wageringRequired: wageringRequired.toString(),
    wageringCompleted: '0',
    expiresAt,
    sourceDepositId: depositId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Notify user
  await db.insert(notification).values({
    id: nanoid(),
    userId,
    type: 'bonus_credited',
    title: '🎁 Welcome Bonus Credited!',
    body: `You received ₹${(Number(bonusAmount) / 100).toFixed(2)} bonus! Wager ₹${(Number(wageringRequired) / 100).toFixed(2)} to unlock it.`,
    metadata: {
      userBonusId: bonusId,
      bonusAmount: bonusAmount.toString(),
      wageringRequired: wageringRequired.toString(),
    },
    createdAt: new Date(),
  });
}
```

#### 2.3 Wagering Tracking

**On Every Bet Settlement:**
```typescript
async function trackWagering(userId: string, betAmount: bigint): Promise<void> {
  // Get all active bonuses for user
  const activeBonuses = await db.query.userBonus.findMany({
    where: and(
      eq(userBonus.userId, userId),
      inArray(userBonus.status, ['pending', 'active']),
      gte(userBonus.expiresAt, new Date())
    )
  });

  if (activeBonuses.length === 0) {
    return; // No active bonuses to track
  }

  // Distribute wagering proportionally across active bonuses
  const totalRemaining = activeBonuses.reduce((sum, bonus) => {
    const remaining = BigInt(bonus.wageringRequired) - BigInt(bonus.wageringCompleted);
    return sum + remaining;
  }, 0n);

  for (const bonus of activeBonuses) {
    const remaining = BigInt(bonus.wageringRequired) - BigInt(bonus.wageringCompleted);
    const share = (betAmount * remaining) / totalRemaining;

    const newWageringCompleted = BigInt(bonus.wageringCompleted) + share;

    // Update bonus wagering progress
    await db.update(userBonus)
      .set({
        wageringCompleted: Math.min(
          newWageringCompleted,
          BigInt(bonus.wageringRequired)
        ).toString(),
        status: 'active', // Mark as active once wagering starts
        updatedAt: new Date(),
      })
      .where(eq(userBonus.id, bonus.id));

    // Check if wagering completed
    if (newWageringCompleted >= BigInt(bonus.wageringRequired)) {
      await completeBonus(bonus.id, userId);
    }
  }
}

async function completeBonus(bonusId: string, userId: string): Promise<void> {
  const bonus = await db.query.userBonus.findFirst({
    where: eq(userBonus.id, bonusId)
  });

  if (!bonus || bonus.status === 'completed') {
    return; // Already completed or not found
  }

  const bonusAmount = BigInt(bonus.awardedAmount);

  // Credit bonus to real balance
  const result = await walletService.updateBalanceAtomic(
    userId,
    bonusAmount,
    'bonus',
    {
      userBonusId: bonus.id,
      type: 'wagering_complete',
    }
  );

  if (!result.success) {
    console.error('[BONUS] Failed to credit completed bonus:', result.error);
    return;
  }

  // Update bonus status
  await db.update(userBonus)
    .set({
      status: 'completed',
      completedAt: new Date(),
      completionTransactionId: result.transactionId,
      updatedAt: new Date(),
    })
    .where(eq(userBonus.id, bonus.id));

  // Notify user
  await db.insert(notification).values({
    id: nanoid(),
    userId,
    type: 'bonus_credited',
    title: '🎉 Bonus Unlocked!',
    body: `You've completed the wagering requirement! ₹${(Number(bonusAmount) / 100).toFixed(2)} has been credited to your balance.`,
    metadata: {
      userBonusId: bonus.id,
      bonusAmount: bonusAmount.toString(),
    },
    createdAt: new Date(),
  });
}
```

#### 2.4 Bonus Expiry

**Daily Cron Job:**
```typescript
// Runs daily at midnight
async function expireBonuses(): Promise<void> {
  // Find expired bonuses
  const expired = await db.query.userBonus.findMany({
    where: and(
      lt(userBonus.expiresAt, new Date()),
      inArray(userBonus.status, ['pending', 'active'])
    )
  });

  for (const bonus of expired) {
    await db.update(userBonus)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(userBonus.id, bonus.id));

    // Notify user
    await db.insert(notification).values({
      id: nanoid(),
      userId: bonus.userId,
      type: 'bonus_expiring',
      title: '⏰ Bonus Expired',
      body: `Your ₹${(Number(bonus.awardedAmount) / 100).toFixed(2)} bonus has expired.`,
      metadata: {
        userBonusId: bonus.id,
      },
      createdAt: new Date(),
    });
  }
}
```

#### 2.5 Bonus Forfeiture

**On Withdrawal Request:**
```typescript
async function checkBonusForfeiture(userId: string): Promise<void> {
  // Find active bonuses
  const activeBonuses = await db.query.userBonus.findMany({
    where: and(
      eq(userBonus.userId, userId),
      inArray(userBonus.status, ['pending', 'active'])
    )
  });

  if (activeBonuses.length === 0) {
    return; // No active bonuses
  }

  // Forfeit all active bonuses
  for (const bonus of activeBonuses) {
    await db.update(userBonus)
      .set({
        status: 'forfeited',
        updatedAt: new Date(),
      })
      .where(eq(userBonus.id, bonus.id));
  }

  // Notify user
  await db.insert(notification).values({
    id: nanoid(),
    userId,
    type: 'system',
    title: '⚠️ Bonus Forfeited',
    body: `Withdrawing before meeting wagering requirements has forfeited ${activeBonuses.length} bonus(es).`,
    createdAt: new Date(),
  });
}
```

#### 2.6 API Endpoints

**Bonus Router (`server/routers/bonus.ts`):**
```typescript
export const bonusRouter = router({
  /**
   * Get user's active bonuses
   */
  getActiveBonuses: protectedProcedure
    .query(async ({ ctx }) => {
      const bonuses = await db.query.userBonus.findMany({
        where: and(
          eq(userBonus.userId, ctx.user.id),
          inArray(userBonus.status, ['pending', 'active']),
          gte(userBonus.expiresAt, new Date())
        ),
        with: {
          template: true,
        },
        orderBy: [desc(userBonus.createdAt)],
      });

      return bonuses.map(bonus => ({
        id: bonus.id,
        name: bonus.template?.name || 'Bonus',
        awardedAmount: bonus.awardedAmount,
        wageringRequired: bonus.wageringRequired,
        wageringCompleted: bonus.wageringCompleted,
        expiresAt: bonus.expiresAt,
        progress: Number(BigInt(bonus.wageringCompleted) * 100n / BigInt(bonus.wageringRequired)),
      }));
    }),

  /**
   * Get bonus history
   */
  getBonusHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const bonuses = await db.query.userBonus.findMany({
        where: eq(userBonus.userId, ctx.user.id),
        with: {
          template: true,
        },
        orderBy: [desc(userBonus.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return bonuses;
    }),
});
```

---

## Phase 3: VIP Foundation

### Overview

The VIP foundation tracks user's total wagered amount and automatically upgrades their tier through the 5-tier system: Bronze → Silver → Gold → Platinum → Diamond.

**Timeline:** Week 4-5  
**Priority:** High (Retention foundation)

### Components

#### 3.1 VIP Tier Thresholds

| Tier    | Total Wagered (₹) | Bonus Multiplier | Minimum Deposit |
|---------|-------------------|------------------|-----------------|
| Bronze  | 0 - 49,999       | 1.0x (base)     | ₹100            |
| Silver  | 50,000 - 199,999  | 1.1x (10% better)| ₹500            |
| Gold    | 200,000 - 499,999 | 1.25x (25% better)| ₹1,000        |
| Platinum| 500,000 - 999,999 | 1.5x (50% better)| ₹2,000          |
| Diamond | 1,000,000+        | 2.0x (100% better)| ₹5,000         |

**Tier Calculation:**
```typescript
function calculateVIPTier(totalWagered: bigint): string {
  const thresholds = {
    'Diamond': 100000000n,   // ₹1,000,000 in paisa
    'Platinum': 50000000n,   // ₹500,000
    'Gold': 20000000n,       // ₹200,000
    'Silver': 5000000n,      // ₹50,000
    'Bronze': 0n,
  };

  if (totalWagered >= thresholds['Diamond']) return 'Diamond';
  if (totalWagered >= thresholds['Platinum']) return 'Platinum';
  if (totalWagered >= thresholds['Gold']) return 'Gold';
  if (totalWagered >= thresholds['Silver']) return 'Silver';
  return 'Bronze';
}

function getNextTierThreshold(currentTier: string): bigint | null {
  const thresholds = {
    'Bronze': 5000000n,     // Next: Silver at ₹50,000
    'Silver': 20000000n,    // Next: Gold at ₹200,000
    'Gold': 50000000n,      // Next: Platinum at ₹500,000
    'Platinum': 100000000n, // Next: Diamond at ₹1,000,000
    'Diamond': null,        // Max tier
  };

  return thresholds[currentTier] || null;
}
```

#### 3.2 VIP Progress Tracking

**On Every Bet Settlement:**
```typescript
async function trackVIPProgress(userId: string, betAmount: bigint): Promise<void> {
  // Get or create game stats record
  let userStats = await db.query.gameStats.findFirst({
    where: eq(gameStats.userId, userId)
  });

  if (!userStats) {
    // Create game stats record
    await db.insert(gameStats).values({
      id: nanoid(),
      userId,
      totalWagered: betAmount.toString(),
      totalBets: 1,
      statsVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userStats = await db.query.gameStats.findFirst({
      where: eq(gameStats.userId, userId)
    });
  }

  if (!userStats) return;

  // Atomic update of total wagered with optimistic locking
  const currentVersion = userStats.statsVersion;
  const currentWagered = BigInt(userStats.totalWagered);
  const newWagered = currentWagered + betAmount;

  const updateResult = await db.update(gameStats)
    .set({
      totalWagered: newWagered.toString(),
      statsVersion: currentVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(
      eq(gameStats.id, userStats.id),
      eq(gameStats.statsVersion, currentVersion)
    ))
    .returning();

  if (updateResult.length === 0) {
    // Concurrent modification detected, retry
    await new Promise(resolve => setTimeout(resolve, 50));
    return trackVIPProgress(userId, betAmount);
  }

  // Check if tier should upgrade
  await checkVIPTierUpgrade(userId, newWagered);
}

async function checkVIPTierUpgrade(userId: string, totalWagered: bigint): Promise<void> {
  const user = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { vipLevel: true }
  });

  if (!user) return;

  const currentTier = user.vipLevel;
  const newTier = calculateVIPTier(totalWagered);

  if (currentTier === newTier) {
    return; // No tier change
  }

  // Check if upgrade (never downgrade)
  const tierOrder = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const newIndex = tierOrder.indexOf(newTier);

  if (newIndex <= currentIndex) {
    return; // Not an upgrade
  }

  // Upgrade user's VIP tier
  await db.update(user)
    .set({
      vipLevel: newTier,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  // Create notification
  await db.insert(notification).values({
    id: nanoid(),
    userId,
    type: 'system',
    title: `🎉 Congratulations! You've reached ${newTier} tier!`,
    body: `You now have access to exclusive bonus offers. Keep playing to unlock ${tierOrder[newIndex + 1] || 'max'} tier!`,
    metadata: {
      oldTier: currentTier,
      newTier,
    },
    createdAt: new Date(),
  });

  // Log to audit
  await db.insert(auditLog).values({
    id: nanoid(),
    actorId: userId,
    actorRole: 'system',
    action: 'user_vip_upgrade',
    targetType: 'user',
    targetId: userId,
    before: { tier: currentTier },
    after: { tier: newTier },
    createdAt: new Date(),
  });
}
```

#### 3.3 VIP Bonus Multiplier

**Apply Multiplier to All Bonuses:**
```typescript
function getVIPBonusMultiplier(vipLevel: string): number {
  const multipliers: Record<string, number> = {
    'Bronze': 1.0,
    'Silver': 1.1,   // 10% better
    'Gold': 1.25,    // 25% better
    'Platinum': 1.5, // 50% better
    'Diamond': 2.0,  // 100% better (2x)
  };

  return multipliers[vipLevel] || 1.0;
}

// Example: Calculate referral bonus with VIP multiplier
function calculateReferralBonus(
  depositAmount: bigint,
  vipLevel: string
): bigint {
  const baseBonus = (depositAmount * 10n) / 100n; // 10%
  const multiplier = getVIPBonusMultiplier(vipLevel);
  const multiplied = (baseBonus * BigInt(Math.floor(multiplier * 100))) / 100n;

  return Math.min(multiplied, 200000n); // Cap at ₹2,000
}
```

#### 3.4 API Endpoints

**VIP Router (`server/routers/vip.ts`):**
```typescript
export const vipRouter = router({
  /**
   * Get user's VIP status
   */
  getVIPStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { vipLevel: true },
        with: {
          gameStats: true,
        }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      const currentTier = user.vipLevel;
      const totalWagered = BigInt(user.gameStats?.totalWagered || 0);
      const nextThreshold = getNextTierThreshold(currentTier);
      const progress = nextThreshold
        ? Number(totalWagered * 100n / nextThreshold)
        : 100;

      const tierOrder = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
      const nextTier = tierOrder[tierOrder.indexOf(currentTier) + 1] || null;

      return {
        currentTier,
        totalWagered: totalWagered.toString(),
        nextTier,
        nextThreshold: nextThreshold?.toString() || null,
        progress,
        bonusMultiplier: getVIPBonusMultiplier(currentTier),
      };
    }),

  /**
   * Get VIP benefits for current tier
   */
  getVIPBenefits: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { vipLevel: true }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      const tierBenefits: Record<string, any> = {
        'Bronze': {
          bonusMultiplier: 1.0,
          exclusiveBonuses: [],
          withdrawalLimit: 3, // per day
          supportLevel: 'standard',
        },
        'Silver': {
          bonusMultiplier: 1.1,
          exclusiveBonuses: ['silver-reload-50'],
          withdrawalLimit: 5,
          supportLevel: 'priority',
        },
        'Gold': {
          bonusMultiplier: 1.25,
          exclusiveBonuses: ['gold-weekly-cashback', 'gold-reload-75'],
          withdrawalLimit: 10,
          supportLevel: 'priority',
        },
        'Platinum': {
          bonusMultiplier: 1.5,
          exclusiveBonuses: ['platinum-cashback-15', 'platinum-reload-100'],
          withdrawalLimit: 25,
          supportLevel: 'vip',
        },
        'Diamond': {
          bonusMultiplier: 2.0,
          exclusiveBonuses: ['diamond-cashback-20', 'diamond-reload-150', 'diamond-exclusive'],
          withdrawalLimit: 50,
          supportLevel: 'dedicated',
        },
      };

      return tierBenefits[user.vipLevel] || tierBenefits['Bronze'];
    }),
});
```

---

## Phase 4: Advanced VIP

### Overview

Advanced VIP completes the 5-tier system with Platinum/Diamond tiers, tier-exclusive bonus offers, and admin dashboard for bonus management.

**Timeline:** Week 6+  
**Priority:** Medium (Retention optimization)

### Components

#### 4.1 Tier-Exclusive Bonus Templates

**Seed Tier-Specific Bonuses:**
```typescript
const tierBonusTemplates = [
  // Silver bonuses
  {
    id: 'silver-reload-50',
    name: 'Silver Reload Bonus 50%',
    description: 'Get 50% bonus on your next deposit',
    type: 'deposit_match',
    value: '50',
    maxValue: '10000', // ₹1,000 max
    wageringMultiplier: '15',
    expiryDays: 7,
    maxClaimsPerUser: 5, // 5 times per user
    requiredTier: 'Silver',
    isActive: true,
  },
  {
    id: 'silver-free-bet-200',
    name: 'Silver Free Bet ₹200',
    description: 'Get a free ₹200 bet ticket',
    type: 'free_bet',
    value: '20000', // ₹200
    maxValue: '20000',
    wageringMultiplier: '10',
    expiryDays: 14,
    maxClaimsPerUser: 3,
    requiredTier: 'Silver',
    isActive: true,
  },

  // Gold bonuses
  {
    id: 'gold-weekly-cashback',
    name: 'Gold Weekly Cashback 10%',
    description: 'Get 10% cashback on weekly losses',
    type: 'cashback',
    value: '10',
    maxValue: '50000', // ₹5,000 max per week
    wageringMultiplier: '5',
    expiryDays: 7,
    maxClaimsPerUser: 52, // Once per week for a year
    requiredTier: 'Gold',
    isActive: true,
  },
  {
    id: 'gold-reload-75',
    name: 'Gold Reload Bonus 75%',
    description: 'Get 75% bonus on your next deposit',
    type: 'deposit_match',
    value: '75',
    maxValue: '25000', // ₹2,500 max
    wageringMultiplier: '15',
    expiryDays: 7,
    maxClaimsPerUser: 10,
    requiredTier: 'Gold',
    isActive: true,
  },

  // Platinum bonuses
  {
    id: 'platinum-cashback-15',
    name: 'Platinum Weekly Cashback 15%',
    description: 'Get 15% cashback on weekly losses',
    type: 'cashback',
    value: '15',
    maxValue: '100000', // ₹10,000 max per week
    wageringMultiplier: '5',
    expiryDays: 7,
    maxClaimsPerUser: 52,
    requiredTier: 'Platinum',
    isActive: true,
  },
  {
    id: 'platinum-reload-100',
    name: 'Platinum Reload Bonus 100%',
    description: 'Get 100% bonus on your next deposit',
    type: 'deposit_match',
    value: '100',
    maxValue: '50000', // ₹5,000 max
    wageringMultiplier: '15',
    expiryDays: 7,
    maxClaimsPerUser: 15,
    requiredTier: 'Platinum',
    isActive: true,
  },

  // Diamond bonuses
  {
    id: 'diamond-cashback-20',
    name: 'Diamond Weekly Cashback 20%',
    description: 'Get 20% cashback on weekly losses',
    type: 'cashback',
    value: '20',
    maxValue: '200000', // ₹20,000 max per week
    wageringMultiplier: '3',
    expiryDays: 7,
    maxClaimsPerUser: 52,
    requiredTier: 'Diamond',
    isActive: true,
  },
  {
    id: 'diamond-reload-150',
    name: 'Diamond Reload Bonus 150%',
    description: 'Get 150% bonus on your next deposit',
    type: 'deposit_match',
    value: '150',
    maxValue: '100000', // ₹10,000 max
    wageringMultiplier: '10',
    expiryDays: 7,
    maxClaimsPerUser: 20,
    requiredTier: 'Diamond',
    isActive: true,
  },
  {
    id: 'diamond-exclusive',
    name: 'Diamond Exclusive Experience',
    description: 'Exclusive VIP events and personalized offers',
    type: 'manual',
    value: '0',
    maxValue: null,
    wageringMultiplier: '1',
    expiryDays: 30,
    maxClaimsPerUser: null,
    requiredTier: 'Diamond',
    isActive: true,
  },
];

// Seed in database
for (const template of tierBonusTemplates) {
  await db.insert(bonusTemplate).values({
    ...template,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

#### 4.2 Bonus Eligibility Check

```typescript
async function canClaimBonus(userId: string, templateId: string): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  const user = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { vipLevel: true }
  });

  if (!user) {
    return { eligible: false, reason: 'User not found' };
  }

  const template = await db.query.bonusTemplate.findFirst({
    where: eq(bonusTemplate.id, templateId)
  });

  if (!template) {
    return { eligible: false, reason: 'Bonus template not found' };
  }

  if (!template.isActive) {
    return { eligible: false, reason: 'Bonus is not currently active' };
  }

  // Check VIP tier requirement
  if (template.requiredTier) {
    const tierOrder = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    const userTierIndex = tierOrder.indexOf(user.vipLevel);
    const requiredTierIndex = tierOrder.indexOf(template.requiredTier);

    if (userTierIndex < requiredTierIndex) {
      return {
        eligible: false,
        reason: `This bonus requires ${template.requiredTier} tier or higher`
      };
    }
  }

  // Check max claims per user
  if (template.maxClaimsPerUser) {
    const claimsCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(userBonus)
      .where(and(
        eq(userBonus.userId, userId),
        eq(userBonus.templateId, templateId)
      ));

    if (claimsCount[0].count >= template.maxClaimsPerUser) {
      return {
        eligible: false,
        reason: 'You have already claimed this bonus the maximum number of times'
      };
    }
  }

  return { eligible: true };
}
```

#### 4.3 Bonus Claiming

```typescript
async function claimBonus(userId: string, templateId: string): Promise<{
  success: boolean;
  bonusId?: string;
  error?: string;
}> {
  // Check eligibility
  const eligibility = await canClaimBonus(userId, templateId);
  if (!eligibility.eligible) {
    return {
      success: false,
      error: eligibility.reason || 'Not eligible for this bonus'
    };
  }

  const template = await db.query.bonusTemplate.findFirst({
    where: eq(bonusTemplate.id, templateId)
  });

  if (!template) {
    return { success: false, error: 'Template not found' };
  }

  // Calculate bonus amount based on type
  let bonusAmount: bigint;

  switch (template.type) {
    case 'deposit_match':
      // Requires deposit amount (handled in separate flow)
      return { success: false, error: 'Deposit required first' };

    case 'free_bet':
    case 'manual':
      bonusAmount = BigInt(template.value);
      break;

    case 'cashback':
      // Calculate based on weekly losses (handled in weekly cron)
      return { success: false, error: 'Cashback calculated automatically' };

    default:
      return { success: false, error: 'Unknown bonus type' };
  }

  // Create user bonus record
  const wageringRequired = (bonusAmount * BigInt(template.wageringMultiplier)) / 100n;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (template.expiryDays || 30));

  const userBonusId = nanoid();

  await db.insert(userBonus).values({
    id: userBonusId,
    userId,
    templateId: template.id,
    awardedAmount: bonusAmount.toString(),
    status: 'pending',
    wageringRequired: wageringRequired.toString(),
    wageringCompleted: '0',
    expiresAt,
    issuedBy: null, // System-issued
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Notify user
  await db.insert(notification).values({
    id: nanoid(),
    userId,
    type: 'bonus_credited',
    title: `🎁 Bonus Claimed: ${template.name}`,
    body: `You received ₹${(Number(bonusAmount) / 100).toFixed(2)} bonus! Wager ₹${(Number(wageringRequired) / 100).toFixed(2)} to unlock it.`,
    metadata: {
      userBonusId,
      bonusAmount: bonusAmount.toString(),
      wageringRequired: wageringRequired.toString(),
    },
    createdAt: new Date(),
  });

  return { success: true, bonusId: userBonusId };
}
```

#### 4.4 Admin Dashboard

**Admin Router (`server/routers/admin.ts`):**
```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';

export const adminRouter = router({
  /**
   * Create bonus template
   */
  createBonusTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      type: z.enum(['welcome', 'referral', 'deposit_match', 'free_bet', 'manual', 'cashback']),
      value: z.string(), // Decimal string
      maxValue: z.string().optional(),
      wageringMultiplier: z.string().default('20'),
      expiryDays: z.number().default(30),
      maxClaimsPerUser: z.number().optional(),
      requiredTier: z.enum(['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']).optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Verify admin role
      const templateId = nanoid();

      await db.insert(bonusTemplate).values({
        id: templateId,
        name: input.name,
        description: input.description,
        type: input.type,
        value: input.value,
        maxValue: input.maxValue,
        wageringMultiplier: input.wageringMultiplier,
        expiryDays: input.expiryDays,
        maxClaimsPerUser: input.maxClaimsPerUser,
        requiredTier: input.requiredTier,
        isActive: input.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true, templateId };
    }),

  /**
   * Update bonus template
   */
  updateBonusTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Verify admin role
      await db.update(bonusTemplate)
        .set({
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          updatedAt: new Date(),
        })
        .where(eq(bonusTemplate.id, input.templateId));

      return { success: true };
    }),

  /**
   * List bonus templates with usage stats
   */
  listBonusTemplates: protectedProcedure
    .input(z.object({
      isActive: z.boolean().optional(),
      type: z.enum(['welcome', 'referral', 'deposit_match', 'free_bet', 'manual', 'cashback']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where = [];
      if (input.isActive !== undefined) {
        where.push(eq(bonusTemplate.isActive, input.isActive));
      }
      if (input.type) {
        where.push(eq(bonusTemplate.type, input.type));
      }

      const templates = await db.query.bonusTemplate.findMany({
        where: and(...where),
        with: {
          userBonuses: true,
        },
        orderBy: [desc(bonusTemplate.createdAt)],
      });

      return templates.map(template => ({
        id: template.id,
        name: template.name,
        type: template.type,
        value: template.value,
        maxValue: template.maxValue,
        isActive: template.isActive,
        totalClaims: template.userBonuses.length,
        totalAwarded: template.userBonuses.reduce((sum, bonus) => {
          return sum + BigInt(bonus.awardedAmount);
        }, 0n).toString(),
      }));
    }),

  /**
   * List user bonuses (admin view)
   */
  listUserBonuses: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      status: z.enum(['pending', 'active', 'completed', 'expired', 'forfeited']).optional(),
      templateId: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const where = [];
      if (input.userId) {
        where.push(eq(userBonus.userId, input.userId));
      }
      if (input.status) {
        where.push(eq(userBonus.status, input.status));
      }
      if (input.templateId) {
        where.push(eq(userBonus.templateId, input.templateId));
      }

      const bonuses = await db.query.userBonus.findMany({
        where: and(...where),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              email: true,
              vipLevel: true,
            }
          },
          template: true,
        },
        orderBy: [desc(userBonus.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return bonuses;
    }),

  /**
   * Cancel bonus (admin action)
   */
  cancelBonus: protectedProcedure
    .input(z.object({
      bonusId: z.string(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Verify admin role

      const bonus = await db.query.userBonus.findFirst({
        where: eq(userBonus.id, input.bonusId)
      });

      if (!bonus) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bonus not found'
        });
      }

      if (bonus.status === 'completed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel completed bonus'
        });
      }

      await db.update(userBonus)
        .set({
          status: 'cancelled',
          notes: input.reason,
          updatedAt: new Date(),
        })
        .where(eq(userBonus.id, input.bonusId));

      // Log to audit
      await db.insert(auditLog).values({
        id: nanoid(),
        actorId: ctx.user.id,
        actorRole: 'admin',
        action: 'bonus_cancelled',
        targetType: 'userBonus',
        targetId: input.bonusId,
        before: { status: bonus.status },
        after: { status: 'cancelled', reason: input.reason },
        createdAt: new Date(),
      });

      return { success: true };
    }),
});
```

---

## Data Flows

### Flow 1: User Signup with Referral

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                         │
│                                                               │
│  User fills signup form:                                     │
│  - Email: friend@example.com                                │
│  - Password: ********                                        │
│  - Referral Code: CLUB2024XYZ                               │
│                                                               │
│  POST /api/auth/signUp                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (tRPC Router)                       │
│                                                               │
│  1. Validate referral code exists in DB                      │
│  2. Check IP against referrer's last signup IP              │
│  3. Check email similarity (self-referral prevention)      │
│  4. Generate unique referral code for new user             │
│  5. Create user record                                       │
│  6. Create referral record (status: pending)                │
│  7. Return user data + referral code                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Database                                  │
│                                                               │
│  INSERT INTO user (id, email, referral_code, ...)           │
│  INSERT INTO referral (id, referrer_id, referred_user_id,   │
│                       referral_code, status, ...)             │
│                                                               │
│  Referral status: pending                                    │
│  Qualify deadline: NOW + 7 days                              │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: First Deposit with Welcome Bonus & Referral Qualification

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                         │
│                                                               │
│  User deposits ₹1,000 via UPI                               │
│  Payment gateway processes...                               │
│                                                               │
│  Webhook: POST /api/transaction/confirmDeposit              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (tRPC Router)                       │
│                                                               │
│  1. Verify deposit with gateway                              │
│  2. Update deposit status: completed                        │
│  3. Credit deposit amount to user balance                    │
│  4. Check if first deposit:                                  │
│     - Yes → Award welcome bonus (100% match, 20x wagering)   │
│  5. Check for pending referral:                              │
│     - Yes → Calculate referral bonus (10%, max ₹2,000)       │
│     - Update referral status: qualified → rewarded           │
│     - Credit bonus to referrer balance                       │
│  6. Send notifications to user and referrer                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Database                                  │
│                                                               │
│  UPDATE deposit SET status = 'completed'                     │
│  UPDATE transaction SET status = 'completed'                 │
│  UPDATE user SET balance = balance + deposit_amount         │
│                                                               │
│  INSERT INTO user_bonus (id, user_id, template_id,          │
│                         awarded_amount, wagering_required,   │
│                         source_deposit_id, ...)               │
│                                                               │
│  UPDATE referral SET status = 'rewarded',                    │
│                    qualified_at = NOW(),                      │
│                    rewarded_at = NOW(),                       │
│                    bonus_transaction_id = ...                 │
│                                                               │
│  INSERT INTO notification (id, user_id, type, title, body)   │
│  x 2 (one for user, one for referrer)                        │
└─────────────────────────────────────────────────────────────┘
```

### Flow 3: Bet Settlement with Wagering Tracking & VIP Progress

```
┌─────────────────────────────────────────────────────────────┐
│              Game Aggregator / Game API                     │
│                                                               │
│  Bet placed: ₹100 on Roulette                               │
│  Bet settled: User won ₹200                                 │
│                                                               │
│  POST /api/wallet/aggregatorCredit                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (tRPC Router)                       │
│                                                               │
│  1. Verify bet and calculate winnings                        │
│  2. Credit winnings to user balance                          │
│  3. Track wagering for active bonuses:                        │
│     - For each active bonus:                                 │
│       - Calculate share of wagering                          │
│       - Update wagering_completed                            │
│       - If wagering_complete → Credit bonus to balance       │
│  4. Track VIP progress:                                      │
│     - Update game_stats.total_wagered                       │
│     - Check if tier should upgrade                           │
│     - If upgrade → Update user.vip_level + notify            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Database                                  │
│                                                               │
│  UPDATE transaction SET status = 'completed'                 │
│  UPDATE user SET balance = balance + winnings                │
│                                                               │
│  UPDATE user_bonus SET wagering_completed = wagering_completed + wager_share│
│  (for each active bonus)                                      │
│                                                               │
│  UPDATE game_stats SET total_wagered = total_wagered + bet_amount│
│                              stats_version = stats_version + 1│
│                                                               │
│  IF wagering_completed >= wagering_required:                 │
│    UPDATE user_bonus SET status = 'completed',                │
│                        completed_at = NOW()                   │
│    UPDATE user SET balance = balance + bonus_amount         │
│                                                               │
│  IF vip_level should upgrade:                                │
│    UPDATE user SET vip_level = new_tier                     │
│    INSERT INTO notification (...)                            │
│    INSERT INTO audit_log (...)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Referral Errors

**ERR-REF-001: Invalid Referral Code**
```typescript
// Error: Referral code doesn't exist
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Invalid referral code. Please check and try again.',
});
```

**ERR-REF-002: Self-Referral Detected**
```typescript
// Error: User trying to refer themselves
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Cannot use your own referral code. Please ask a friend to refer you.',
});
```

**ERR-REF-003: Referral Expired**
```typescript
// Error: Referral not qualified within 7 days
// Handled in cron job, sets status to 'expired'
// Returns to user as: "Referral period has expired"
```

### Bonus Errors

**ERR-BON-001: Bonus Already Claimed**
```typescript
// Error: User trying to claim welcome bonus twice
throw new TRPCError({
  code: 'CONFLICT',
  message: 'You have already claimed this welcome bonus.',
});
```

**ERR-BON-002: Bonus Expired**
```typescript
// Error: Trying to use expired bonus
// Returns in getActiveBonuses query: status = 'expired'
// User message: "This bonus has expired. Check available bonuses."
```

**ERR-BON-003: Wagering Not Met**
```typescript
// Error: User trying to withdraw before meeting wagering
// Handled by forfeiting bonus automatically
// Notification: "Withdrawal before meeting wagering requirements forfeits bonus."
```

### VIP Errors

**ERR-VIP-001: Tier Requirement Not Met**
```typescript
// Error: User trying to claim bonus above their tier
return {
  eligible: false,
  reason: `This bonus requires ${template.requiredTier} tier or higher. Current tier: ${user.vipLevel}`
};
```

**ERR-VIP-002: Concurrent Modification**
```typescript
// Error: Race condition in game_stats update
// Handled by optimistic locking retry
if (updateResult.rows.length === 0) {
  // Retry after brief delay
  await new Promise(resolve => setTimeout(resolve, 50));
  return trackVIPProgress(userId, betAmount);
}
```

---

## Testing Strategy

### Unit Tests

**Referral System Tests:**
```typescript
describe('Referral System', () => {
  test('generates unique referral code on signup', async () => {
    const user = await signUp({ email: 'test@example.com' });
    expect(user.referralCode).toMatch(/^[A-Z0-9]{12}$/);
    expect(user.referralCode).toHaveLength(12);
  });

  test('creates referral record when user signs up with code', async () => {
    const referrer = await signUp({ email: 'referrer@example.com' });
    const referred = await signUp({ 
      email: 'referred@example.com',
      referralCode: referrer.referralCode 
    });

    const referral = await getReferral(referrer.id, referred.id);
    expect(referral.status).toBe('pending');
    expect(referral.referrerId).toBe(referrer.id);
    expect(referral.referredUserId).toBe(referred.id);
  });

  test('credits referral bonus on friend first deposit', async () => {
    const referrer = await signUp({ email: 'referrer@example.com' });
    const referred = await signUp({ 
      email: 'referred@example.com',
      referralCode: referrer.referralCode 
    });

    await deposit(referred.id, '5000'); // ₹50 deposit

    const referrerBalance = await getBalance(referrer.id);
    expect(referrerBalance).toBe('250'); // 10% of ₹50 = ₹5
  });

  test('caps referral bonus at ₹2,000', async () => {
    const referrer = await signUp({ email: 'referrer@example.com' });
    const referred = await signUp({ 
      email: 'referred@example.com',
      referralCode: referrer.referralCode 
    });

    await deposit(referred.id, '50000'); // ₹500 deposit

    const referrerBalance = await getBalance(referrer.id);
    expect(referrerBalance).toBe('10000'); // Capped at ₹2,000
  });

  test('rejects self-referral by IP', async () => {
    const referrer = await signUp({ 
      email: 'referrer@example.com',
      ipAddress: '192.168.1.100'
    });

    await expect(
      signUp({ 
        email: 'fake@example.com',
        referralCode: referrer.referralCode,
        ipAddress: '192.168.1.100'
      })
    ).rejects.toThrow('Cannot use your own referral code');
  });

  test('expires referral after 7 days', async () => {
    const referrer = await signUp({ email: 'referrer@example.com' });
    const referred = await signUp({ 
      email: 'referred@example.com',
      referralCode: referrer.referralCode 
    });

    // Fast-forward 8 days
    await advanceTime(8 * 24 * 60 * 60 * 1000);
    await expireReferrals();

    const referral = await getReferral(referrer.id, referred.id);
    expect(referral.status).toBe('expired');
  });
});
```

**Bonus System Tests:**
```typescript
describe('Welcome Bonus', () => {
  test('awards welcome bonus on first deposit', async () => {
    const user = await signUp({ email: 'test@example.com' });
    await deposit(user.id, '5000'); // ₹50 deposit

    const bonus = await getActiveBonus(user.id);
    expect(bonus.awardedAmount).toBe('5000'); // 100% of ₹50
    expect(bonus.wageringRequired).toBe('100000'); // 20x = ₹1,000
  });

  test('caps welcome bonus at ₹10,000', async () => {
    const user = await signUp({ email: 'test@example.com' });
    await deposit(user.id, '200000'); // ₹2,000 deposit

    const bonus = await getActiveBonus(user.id);
    expect(bonus.awardedAmount).toBe('100000'); // Capped at ₹10,000
  });

  test('tracks wagering progress', async () => {
    const user = await signUp({ email: 'test@example.com' });
    await deposit(user.id, '5000'); // ₹50 bonus

    await betAndSettle(user.id, '2000'); // ₹20 bet
    await betAndSettle(user.id, '3000'); // ₹30 bet

    const bonus = await getActiveBonus(user.id);
    expect(bonus.wageringCompleted).toBe('5000'); // ₹20 + ₹30 = ₹50
  });

  test('credits bonus when wagering complete', async () => {
    const user = await signUp({ email: 'test@example.com' });
    await deposit(user.id, '5000'); // ₹50 bonus

    // Wager ₹1,000 (20x)
    for (let i = 0; i < 10; i++) {
      await betAndSettle(user.id, '10000'); // ₹100 × 10 = ₹1,000
    }

    const balance = await getBalance(user.id);
    expect(balance).toBe('5000'); // Bonus credited
  });

  test('expires bonus after 30 days', async () => {
    const user = await signUp({ email: 'test@example.com' });
    await deposit(user.id, '5000');

    await advanceTime(31 * 24 * 60 * 60 * 1000);
    await expireBonuses();

    const bonus = await getBonus(user.id);
    expect(bonus.status).toBe('expired');
  });
});
```

**VIP System Tests:**
```typescript
describe('VIP System', () => {
  test('user starts at Bronze tier', async () => {
    const user = await signUp({ email: 'test@example.com' });
    expect(user.vipLevel).toBe('Bronze');
  });

  test('upgrades to Silver at ₹50K wagered', async () => {
    const user = await signUp({ email: 'test@example.com' });
    
    await betAndSettle(user.id, '5000000'); // ₹50,000

    const updatedUser = await getUser(user.id);
    expect(updatedUser.vipLevel).toBe('Silver');
  });

  test('upgrades through all tiers', async () => {
    const user = await signUp({ email: 'test@example.com' });

    expect(user.vipLevel).toBe('Bronze');

    await betAndSettle(user.id, '5000000'); // ₹50K
    expect((await getUser(user.id)).vipLevel).toBe('Silver');

    await betAndSettle(user.id, '15000000'); // +₹150K = ₹200K total
    expect((await getUser(user.id)).vipLevel).toBe('Gold');

    await betAndSettle(user.id, '30000000'); // +₹300K = ₹500K total
    expect((await getUser(user.id)).vipLevel).toBe('Platinum');

    await betAndSettle(user.id, '50000000'); // +₹500K = ₹1M total
    expect((await getUser(user.id)).vipLevel).toBe('Diamond');
  });

  test('applies VIP bonus multiplier', async () => {
    const user = await signUp({ email: 'test@example.com' });
    
    // Upgrade to Gold
    await betAndSettle(user.id, '20000000'); // ₹200K

    const referral = await createReferral(user.id);
    const friend = await signUpWithReferral(referral.code);
    await deposit(friend.id, '50000'); // ₹500 deposit

    // Gold gets 25% better: 10% × 1.25 = 12.5%
    const expectedBonus = 50000 * 0.125; // ₹62.5
    const referrerBalance = await getBalance(user.id);
    expect(Number(referrerBalance)).toBeCloseTo(6250, 0); // ₹62.5
  });

  test('never downgrades VIP tier', async () => {
    const user = await signUp({ email: 'test@example.com' });
    
    await betAndSettle(user.id, '20000000'); // Reach Gold
    expect((await getUser(user.id)).vipLevel).toBe('Gold');

    // No downgrade mechanism - tier is permanent
    // Policy: once Diamond, always Diamond
  });
});
```

### Integration Tests

**Full Referral Flow:**
```typescript
describe('Referral Integration Flow', () => {
  test('complete referral cycle from signup to bonus', async () => {
    // 1. Referrer signs up
    const referrer = await signUp({ email: 'referrer@example.com' });
    expect(referrer.referralCode).toBeTruthy();

    // 2. Referrer shares code
    const referralLink = await getReferralLink(referrer.id);
    expect(referralLink).toContain(referrer.referralCode);

    // 3. Friend signs up with code
    const friend = await signUp({ 
      email: 'friend@example.com',
      referralCode: referrer.referralCode 
    });

    // 4. Verify referral created
    const referral = await getReferral(referrer.id, friend.id);
    expect(referral.status).toBe('pending');

    // 5. Friend makes first deposit
    await deposit(friend.id, '10000'); // ₹100

    // 6. Verify referral qualified and rewarded
    const updatedReferral = await getReferral(referrer.id, friend.id);
    expect(updatedReferral.status).toBe('rewarded');

    // 7. Verify referrer received bonus
    const referrerBalance = await getBalance(referrer.id);
    expect(referrerBalance).toBe('1000'); // 10% of ₹100 = ₹10

    // 8. Verify notifications sent
    const referrerNotifications = await getNotifications(referrer.id);
    expect(referrerNotifications).toContainEqual(
      expect.objectContaining({ type: 'referral_qualified' })
    );
  });
});
```

**Full Bonus Flow:**
```typescript
describe('Bonus Integration Flow', () => {
  test('welcome bonus from deposit to withdrawal', async () => {
    // 1. User signs up
    const user = await signUp({ email: 'user@example.com' });

    // 2. User makes first deposit
    await deposit(user.id, '10000'); // ₹100

    // 3. Verify welcome bonus awarded
    const bonus = await getActiveBonus(user.id);
    expect(bonus.awardedAmount).toBe('10000'); // ₹100 bonus
    expect(bonus.wageringRequired).toBe('200000'); // 20x = ₹2,000

    // 4. User wagers on games
    for (let i = 0; i < 20; i++) {
      await betAndSettle(user.id, '10000'); // ₹100 × 20 = ₹2,000
    }

    // 5. Verify bonus completed and credited
    const completedBonus = await getBonus(user.id);
    expect(completedBonus.status).toBe('completed');

    // 6. Verify balance includes bonus
    const balance = await getBalance(user.id);
    expect(balance).toBe('10000'); // ₹100 bonus credited
  });
});
```

### Load Tests

**Concurrent Referral Tracking:**
```typescript
describe('Load Testing', () => {
  test('handles 100 concurrent referrals', async () => {
    const referrer = await signUp({ email: 'referrer@example.com' });

    const promises = Array.from({ length: 100 }, async (_, i) => {
      return signUp({ 
        email: `friend${i}@example.com`,
        referralCode: referrer.referralCode 
      });
    });

    await Promise.all(promises);

    const stats = await getReferralStats(referrer.id);
    expect(stats.pending).toBe(100);
  });

  test('handles wagering tracking for 50 concurrent bets', async () => {
    const user = await signUp({ email: 'user@example.com' });
    await deposit(user.id, '10000');

    const promises = Array.from({ length: 50 }, async () => {
      return betAndSettle(user.id, '1000'); // ₹10 bet
    });

    await Promise.all(promises);

    const bonus = await getActiveBonus(user.id);
    expect(bonus.wageringCompleted).toBe('50000'); // ₹10 × 50 = ₹500
  });
});
```

---

## Migration Plan

### Phase 1 Migration

**File:** `drizzle/migrations/YYYYMMDDHHMMSS_add_referral_code.ts`

```typescript
import { sql } from 'drizzle-orm';
import { pgTable, text, varchar, index } from 'drizzle-orm/pg-core';

// Add referralCode column to user table
export async function up(db: any) {
  await db.schema
    .alterTable('user')
    .addColumn('referralCode', 'varchar(12)', (col) => 
      col
        .notNull()
        .default('')
        .unique()
    )
    .execute();

  // Create index for fast lookups
  await db.schema
    .createIndex('user_referralCode_idx')
    .on('user')
    .column('referralCode')
    .execute();
}

export async function down(db: any) {
  await db.schema
    .dropIndex('user_referralCode_idx')
    .execute();

  await db.schema
    .alterTable('user')
    .dropColumn('referralCode')
    .execute();
}
```

### Phase 2-4 Migrations

No additional migrations required. All tables already exist in schema from prior development.

### Data Migration Scripts

**Generate Referral Codes for Existing Users:**
```typescript
// Run after Phase 1 migration
async function generateReferralCodesForExistingUsers() {
  const usersWithoutCodes = await db.select({
    id: user.id,
  })
  .from(user)
  .where(sql`referral_code IS NULL OR referral_code = ''`);

  for (const userData of usersWithoutCodes) {
    const code = await generateReferralCode();
    await db.update(user)
      .set({ referralCode: code })
      .where(eq(user.id, userData.id));
  }

  console.log(`Generated codes for ${usersWithoutCodes.length} users`);
}
```

**Initialize Welcome Bonus Template:**
```typescript
// Run in seed script
await db.insert(bonusTemplate).values({
  id: 'welcome-bonus-100',
  name: 'Welcome Bonus 100% Match',
  description: 'Get 100% bonus on your first deposit up to ₹10,000',
  type: 'welcome',
  value: '100',
  maxValue: '100000',
  wageringMultiplier: '20',
  expiryDays: 30,
  maxClaimsPerUser: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

**Initialize Tier-Exclusive Bonus Templates:**
```typescript
// Run in seed script (Phase 4)
const tierBonusTemplates = [/* templates from Phase 4 section */];

for (const template of tierBonusTemplates) {
  await db.insert(bonusTemplate).values({
    ...template,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

---

## Security Considerations

### Fraud Prevention

**Self-Referral Prevention:**
- IP address tracking and validation
- Email sanitization to catch variations
- Browser fingerprinting (optional enhancement)

**Bonus Abuse Prevention:**
- Velocity limits on bonus claims
- Pattern detection for suspicious behavior
- IP monitoring for multiple accounts

**Collusion Detection:**
- Track users referring from same IP
- Monitor for circular referral patterns
- Alert on unusual referral volumes

### Data Protection

**GDPR Compliance:**
- Referral codes are pseudonymous data
- User consent for referral tracking
- Right to deletion includes referral records

**Audit Trail:**
- All bonus transactions logged
- VIP tier changes audited
- Referral status changes tracked

### Financial Security

**Atomic Transactions:**
- All balance updates use wallet service with optimistic locking
- Bonus crediting uses same atomic guarantees
- No direct balance manipulation

**Idempotency:**
- Bonus claims idempotent
- Referral qualification idempotent
- VIP tier update idempotent

**Rate Limiting:**
- Referral code generation rate limited
- Bonus claim rate limited per user
- API endpoints protected by Redis rate limiting

---

## Performance Optimization

### Database Indexes

```sql
-- Referral lookups
CREATE INDEX "referral_referrerId_idx" ON "referral"("referrer_id");
CREATE INDEX "referral_code_idx" ON "referral"("referral_code");
CREATE INDEX "referral_status_idx" ON "referral"("status");

-- Bonus queries
CREATE INDEX "user_bonus_userId_idx" ON "user_bonus"("user_id");
CREATE INDEX "user_bonus_status_idx" ON "user_bonus"("status");
CREATE INDEX "user_bonus_expiresAt_idx" ON "user_bonus"("expires_at");

-- VIP progress
CREATE INDEX "game_stats_totalWagered_idx" ON "game_stats"("total_wagered");
CREATE INDEX "game_stats_userId_idx" ON "game_stats"("user_id");
```

### Redis Caching

```typescript
// Cache user VIP status
async function getCachedVIPStatus(userId: string): Promise<VIPStatus | null> {
  const cached = await redis.get(`vip:${userId}`);
  if (cached) return JSON.parse(cached);

  const status = await getVIPStatusFromDB(userId);
  await redis.setex(`vip:${userId}`, 300, JSON.stringify(status)); // 5 min

  return status;
}

// Cache referral stats
async function getCachedReferralStats(referrerId: string): Promise<ReferralStats | null> {
  const cached = await redis.get(`referral_stats:${referrerId}`);
  if (cached) return JSON.parse(cached);

  const stats = await getReferralStatsFromDB(referrerId);
  await redis.setex(`referral_stats:${referrerId}`, 300, JSON.stringify(stats));

  return stats;
}
```

### Batch Operations

```typescript
// Process multiple referrals in batch
async function qualifyReferralsBatch(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await qualifyReferral(userId);
  }
}

// Update VIP progress in batch
async function updateVIPProgressBatch(updates: Array<{
  userId: string;
  betAmount: bigint;
}>): Promise<void> {
  for (const { userId, betAmount } of updates) {
    await trackVIPProgress(userId, betAmount);
  }
}
```

---

## Monitoring & Observability

### Key Metrics

**Referral Metrics:**
- Total referrals created
- Referral conversion rate (pending → qualified)
- Referral bonus amount paid
- Average time to qualification

**Bonus Metrics:**
- Welcome bonus claim rate
- Bonus completion rate
- Bonus forfeiture rate
- Average wagering completion time

**VIP Metrics:**
- Tier distribution (users per tier)
- Tier upgrade rate
- VIP bonus utilization
- Time to reach each tier

### Alerts

**System Alerts:**
- Referral code generation failures
- Bonus crediting failures
- VIP tier update failures
- Database connection issues

**Business Alerts:**
- Unusual referral volumes (potential abuse)
- High bonus forfeiture rate
- VIP tier upgrade anomalies
- Payment gateway issues

---

## Future Enhancements

### Phase 5+ (Not in Initial Scope)

**Advanced Referral Features:**
- Multi-tier referral bonuses (refer 10 friends → 15% bonus)
- Referral leaderboards and competitions
- Referral milestone rewards

**Advanced Bonus Features:**
- Reload bonuses (weekly/monthly)
- Cashback system
- Tournament tickets
- Loyalty points exchange

**Advanced VIP Features:**
- Personalized bonus offers
- VIP-only tournaments
- Dedicated account managers
- Real-world rewards (merchandise, trips)

---

## Appendix

### Glossary

- **Referral Code**: 12-character unique code for user referrals
- **Qualified Referral**: Referral where referred user made first deposit
- **Rewarded Referral**: Referral where bonus has been credited to referrer
- **Wagering Requirement**: Amount user must bet before bonus becomes withdrawable
- **VIP Tier**: User level based on total lifetime amount wagered
- **Bonus Multiplier**: Percentage increase in bonus based on VIP tier

### References

- Database Schema: `/drizzle/schema.ts`
- Wallet Service: `/lib/wallet-service.ts`
- Fraud Detection: `/lib/fraud-detection.ts`
- Transaction Router: `/server/routers/transaction.ts`
- Auth Router: `/server/routers/auth.ts`

---

**Document Status:** ✅ Approved  
**Next Steps:** Implementation Planning  
**Estimated Timeline:** 6 weeks for full rollout
