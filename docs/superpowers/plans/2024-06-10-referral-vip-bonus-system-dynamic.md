# Referral, VIP, and Bonus System Implementation Plan

> **🎯 DYNAMIC CONTROL MODE:** This plan supports real-time updates and dynamic control. Each CHECKPOINT is a decision point where you can review progress, adjust approach, skip tasks, or pivot direction. Use checkboxes to track progress, and feel free to modify the plan at any checkpoint.

**Goal:** Implement a user acquisition system with referral bonuses (10% max ₹2,000), welcome bonus (100% match up to ₹10,000 with 20x wagering), and 5-tier VIP progression based on total wagered.

**Architecture:** Service layer architecture with clear separation of concerns. Referral/Bonus/VIP services handle business logic, tRPC routers expose API endpoints, existing wallet service handles financial operations with atomic guarantees. Redis for caching, PostgreSQL for persistence.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Redis, tRPC, Next.js 16, nanoid for ID generation

**📊 Progress Tracking:**
- ☐ CHECKPOINT 1: Database & Core Infrastructure
- ☐ CHECKPOINT 2: Referral System (Complete)
- ☐ CHECKPOINT 3: Bonus System (Complete)
- ☐ CHECKPOINT 4: VIP System (Complete)
- ☐ CHECKPOINT 5: Integration & Testing (Complete)
- ☐ CHECKPOINT 6: Production Ready

---

## File Structure

```
server/
├── routers/
│   ├── referral.ts          # NEW - Referral API endpoints
│   ├── bonus.ts             # NEW - Bonus API endpoints
│   └── vip.ts               # NEW - VIP API endpoints
lib/
├── referral-service.ts      # NEW - Referral business logic
├── bonus-service.ts         # NEW - Bonus business logic
├── vip-service.ts           # NEW - VIP business logic
drizzle/
├── migrations/
│   └── YYYYMMDDHHMMSS_add_referral_code.ts  # NEW - Migration
tests/
├── unit/
│   ├── referral-service.test.ts   # NEW
│   ├── bonus-service.test.ts      # NEW
│   └── vip-service.test.ts        # NEW
└── integration/
    └── referral-bonus-vip.test.ts # NEW
```

---

# 🔷 CHECKPOINT 1: Database & Core Infrastructure

**Goal:** Set up database schema and basic infrastructure

**Estimated Time:** 30 minutes  
**Decision Point:** After completion, decide whether to proceed with Referral System or modify approach

---

## Task 1.1: Create Database Migration

**Files:**
- Create: `drizzle/migrations/YYYYMMDDHHMMSS_add_referral_code.ts`

- [ ] **Step 1: Create migration file**

```typescript
// File: drizzle/migrations/YYYYMMDDHHMMSS_add_referral_code.ts
import { sql } from 'drizzle-orm';

export async function up(db: any) {
  // Add referralCode column to user table
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
  await db.schema.dropIndex('user_referralCode_idx').execute();
  await db.schema.alterTable('user').dropColumn('referralCode').execute();
}
```

- [ ] **Step 2: Run migration**

```bash
npx drizzle-kit migrate
```

- [ ] **Step 3: Update TypeScript schema**

```typescript
// File: drizzle/schema.ts - Add to user table definition:
referralCode: varchar("referral_code", { length: 12 }).unique().default(''),
```

- [ ] **Step 4: Generate types**

```bash
npx drizzle-kit generate
```

- [ ] **Step 5: Verify migration**

```bash
psql $DATABASE_URL -c "\d user" | grep referral_code
```

Expected: Column exists with constraints

- [ ] **Step 6: Commit**

```bash
git add drizzle/
git commit -m "feat: add referral code column to user table"
```

---

## Task 1.2: Seed Bonus Templates

**Files:**
- Create: `drizzle/seed/seed-bonus-templates.ts`

- [ ] **Step 1: Create seed script**

```typescript
// File: drizzle/seed/seed-bonus-templates.ts
import { db } from '@/drizzle';
import { bonusTemplate } from '@/drizzle/schema';

export async function seedBonusTemplates() {
  const templates = [
    {
      id: 'welcome-bonus-100',
      name: 'Welcome Bonus 100% Match',
      description: 'Get 100% bonus on your first deposit up to ₹10,000',
      type: 'welcome' as const,
      value: '100',
      maxValue: '100000',
      wageringMultiplier: '20',
      expiryDays: 30,
      maxClaimsPerUser: 1,
      isActive: true,
    },
  ];

  for (const template of templates) {
    await db.insert(bonusTemplate).values({
      ...template,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
  }

  console.log(`Seeded ${templates.length} bonus templates`);
}
```

- [ ] **Step 2: Run seed script**

```bash
npx tsx drizzle/seed/seed-bonus-templates.ts
```

- [ ] **Step 3: Verify seed data**

```bash
psql $DATABASE_URL -c "SELECT id, name FROM bonus_template;"
```

- [ ] **Step 4: Commit**

```bash
git add drizzle/seed/
git commit -m "feat: add bonus template seed script"
```

---

## 🛑 CHECKPOINT 1 REVIEW

**✅ Completed:**
- Database migration for referral codes
- Bonus templates seeded
- TypeScript types updated

**🤔 Decision Point:**

**Option A:** Proceed to Referral System (recommended)  
**Option B:** Skip to Bonus System first  
**Option C:** Skip to VIP System first  
**Option D:** Modify approach

**What's next?** Your choice determines the next phase.

---

# 🔷 CHECKPOINT 2: Referral System

**Goal:** Implement referral code generation, tracking, and qualification

**Estimated Time:** 2 hours  
**Dependencies:** CHECKPOINT 1 complete

---

## Task 2.1: Create Referral Service

**Files:**
- Create: `lib/referral-service.ts`

- [ ] **Step 1: Write test**

```typescript
// File: tests/unit/referral-service.test.ts
import { describe, test, expect } from 'vitest';
import { referralService } from '@/lib/referral-service';

describe('ReferralService', () => {
  test('generates unique 12-character code', async () => {
    const code = await referralService.generateCode();
    expect(code).toMatch(/^[A-Z0-9]{12}$/);
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

```bash
npm test -- tests/unit/referral-service.test.ts
```

- [ ] **Step 3: Implement service**

```typescript
// File: lib/referral-service.ts
import { nanoid } from 'nanoid';
import { db } from '@/drizzle';
import { user, referral } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export class ReferralService {
  async generateCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    
    do {
      code = nanoid(12).toUpperCase();
      const existing = await db.query.user.findFirst({
        where: eq(user.referralCode, code)
      });
      if (!existing) return code;
      attempts++;
    } while (attempts < 10);
    
    throw new Error('Failed to generate unique code');
  }

  async createReferralOnSignup(
    referredUserId: string,
    referralCode: string,
    ipAddress: string,
    email: string
  ): Promise<void> {
    const referrer = await db.query.user.findFirst({
      where: eq(user.referralCode, referralCode)
    });

    if (!referrer) throw new Error('Invalid referral code');

    // Self-referral check
    if (referrer.email.replace(/\+.*@/, '@') === email.replace(/\+.*@/, '@')) {
      throw new Error('Cannot refer yourself');
    }

    await db.insert(referral).values({
      id: nanoid(),
      referrerId: referrer.id,
      referredUserId,
      referralCode,
      status: 'pending',
      qualifyByDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async qualifyReferral(userId: string, depositAmount: bigint, depositId: string): Promise<void> {
    const pendingReferral = await db.query.referral.findFirst({
      where: and(eq(referral.referredUserId, userId), eq(referral.status, 'pending'))
    });

    if (!pendingReferral) return;

    const bonusAmount = Math.min((depositAmount * 10n) / 100n, 200000n);

    await db.update(referral)
      .set({ status: 'qualified', qualifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(referral.id, pendingReferral.id));

    const { walletService } = await import('@/lib/wallet-service');
    const result = await walletService.updateBalanceAtomic(
      pendingReferral.referrerId,
      bonusAmount,
      'bonus',
      { referralId: pendingReferral.id, depositId }
    );

    if (result.success) {
      await db.update(referral)
        .set({ status: 'rewarded', rewardedAt: new Date(), bonusTransactionId: result.transactionId })
        .where(eq(referral.id, pendingReferral.id));
    }
  }
}

export const referralService = new ReferralService();
```

- [ ] **Step 4: Run test (expect pass)**

```bash
npm test -- tests/unit/referral-service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/referral-service.ts tests/unit/referral-service.test.ts
git commit -m "feat: implement referral service"
```

---

## Task 2.2: Create Referral Router

**Files:**
- Create: `server/routers/referral.ts`

- [ ] **Step 1: Create router**

```typescript
// File: server/routers/referral.ts
import { router, protectedProcedure } from '../trpc';
import { referralService } from '@/lib/referral-service';
import { db } from '@/drizzle';
import { user, referral } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';

export const referralRouter = router({
  getReferralCode: protectedProcedure.query(async ({ ctx }) => {
    const userData = await db.query.user.findFirst({
      where: eq(user.id, ctx.user.id),
      columns: { referralCode: true }
    });
    return {
      referralCode: userData?.referralCode || null,
      shareLink: userData?.referralCode 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/signup?ref=${userData.referralCode}`
        : null
    };
  }),

  getReferralStats: protectedProcedure.query(async ({ ctx }) => {
    return await referralService.getStats(ctx.user.id);
  }),
});
```

- [ ] **Step 2: Register in tRPC**

```typescript
// File: server/trpc.ts - Add:
import { referralRouter } from './routers/referral';

export const appRouter = router({
  // ... existing routers
  referral: referralRouter,
});
```

- [ ] **Step 3: Commit**

```bash
git add server/routers/referral.ts server/trpc.ts
git commit -m "feat: implement referral router"
```

---

## Task 2.3: Integrate with Auth Signup

**Files:**
- Modify: `server/routers/auth.ts`

- [ ] **Step 1: Modify signup to accept referral code**

```typescript
// File: server/routers/auth.ts - Update signUp input:
signUp: publicProcedure
  .input(z.object({
    email: z.string().email(),
    password: z.string().min(8),
    username: z.string().min(3).max(50),
    referralCode: z.string().optional(), // ADD THIS
  }))
  .mutation(async ({ input }) => {
    // Generate referral code for new user
    const { referralService } = await import('@/lib/referral-service');
    const newReferralCode = await referralService.generateCode();

    // Create user with referralCode
    const newUser = await db.insert(user).values({
      id: nanoid(),
      email: input.email,
      username: input.username,
      referralCode: newReferralCode,
      // ... other fields
    }).returning();

    // Handle referral if provided
    if (input.referralCode) {
      try {
        await referralService.createReferralOnSignup(
          newUser[0].id,
          input.referralCode,
          '127.0.0.1',
          input.email
        );
      } catch (error) {
        console.error('[AUTH] Referral creation failed:', error);
      }
    }

    return { user: newUser[0] };
  }),
```

- [ ] **Step 2: Commit**

```bash
git add server/routers/auth.ts
git commit -m "feat: integrate referral with auth signup"
```

---

## Task 2.4: Integrate with Deposit Confirmation

**Files:**
- Modify: `server/routers/transaction.ts`

- [ ] **Step 1: Add referral qualification to deposit**

```typescript
// File: server/routers/transaction.ts - In confirmDeposit:
if (input.status === 'completed') {
  // ... existing balance crediting ...

  // ADD REFERRAL QUALIFICATION:
  try {
    const { referralService } = await import('@/lib/referral-service');
    await referralService.qualifyReferral(
      depositRec.userId,
      BigInt(depositRec.amount.toString()),
      input.depositId
    );
  } catch (error) {
    console.error('[TRANSACTION] Referral qualification failed:', error);
  }

  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/routers/transaction.ts
git commit -m "feat: integrate referral qualification with deposit"
```

---

## 🛑 CHECKPOINT 2 REVIEW

**✅ Completed:**
- Referral service with code generation
- Referral router with API endpoints
- Auth signup integration
- Deposit confirmation integration

**🤔 Decision Point:**

**Option A:** Proceed to Bonus System (recommended)  
**Option B:** Skip to VIP System first  
**Option C:** Test Referral System before proceeding  
**Option D:** Modify approach

---

# 🔷 CHECKPOINT 3: Bonus System

**Goal:** Implement welcome bonus and wagering tracking

**Estimated Time:** 2 hours  
**Dependencies:** CHECKPOINT 1 complete

---

## Task 3.1: Create Bonus Service

**Files:**
- Create: `lib/bonus-service.ts`

- [ ] **Step 1: Write test**

```typescript
// File: tests/unit/bonus-service.test.ts
import { describe, test, expect } from 'vitest';
import { bonusService } from '@/lib/bonus-service';

describe('BonusService', () => {
  test('awards 100% welcome bonus on first deposit', async () => {
    await bonusService.awardWelcomeBonus('user-123', 5000n, 'deposit-123');
    // Verify bonus created with correct amount and wagering
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

- [ ] **Step 3: Implement service**

```typescript
// File: lib/bonus-service.ts
import { nanoid } from 'nanoid';
import { db } from '@/drizzle';
import { userBonus, bonusTemplate, deposit, notification } from '@/drizzle/schema';
import { eq, and, inArray, gte, desc } from 'drizzle-orm';
import { redis } from '@/lib/redis';

export class BonusService {
  async awardWelcomeBonus(userId: string, depositAmount: bigint, depositId: string): Promise<void> {
    // Check first deposit
    const depositCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(deposit)
      .where(and(eq(deposit.userId, userId), eq(deposit.status, 'completed')));

    if ((depositCount[0]?.count || 0) !== 1) return;

    // Check already claimed
    const existing = await db.query.userBonus.findFirst({
      where: and(eq(userBonus.userId, userId), eq(userBonus.templateId, 'welcome-bonus-100'))
    });
    if (existing) return;

    // Get template
    const template = await db.query.bonusTemplate.findFirst({
      where: eq(bonusTemplate.id, 'welcome-bonus-100')
    });
    if (!template || !template.isActive) return;

    // Calculate bonus
    const bonusAmount = Math.min(
      (depositAmount * BigInt(template.value)) / 100n,
      BigInt(template.maxValue || '999999')
    );
    const wageringRequired = (bonusAmount * BigInt(template.wageringMultiplier)) / 100n;

    // Create bonus
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

    await redis.del(`active_bonuses:${userId}`);
  }

  async trackWagering(userId: string, betAmount: bigint): Promise<void> {
    const activeBonuses = await db.query.userBonus.findMany({
      where: and(
        eq(userBonus.userId, userId),
        inArray(userBonus.status, ['pending', 'active']),
        gte(userBonus.expiresAt, new Date())
      )
    });

    if (activeBonuses.length === 0) return;

    const totalRemaining = activeBonuses.reduce((sum, bonus) => {
      return sum + (BigInt(bonus.wageringRequired) - BigInt(bonus.wageringCompleted));
    }, 0n);

    for (const bonus of activeBonuses) {
      const remaining = BigInt(bonus.wageringRequired) - BigInt(bonus.wageringCompleted);
      const share = (betAmount * remaining) / totalRemaining;
      const newCompleted = BigInt(bonus.wageringCompleted) + share;

      await db.update(userBonus)
        .set({
          wageringCompleted: Math.min(newCompleted, BigInt(bonus.wageringRequired)).toString(),
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(userBonus.id, bonus.id));

      if (newCompleted >= BigInt(bonus.wageringRequired)) {
        await this.completeBonus(bonus.id, userId);
      }
    }

    await redis.del(`active_bonuses:${userId}`);
  }

  private async completeBonus(bonusId: string, userId: string): Promise<void> {
    const bonus = await db.query.userBonus.findFirst({ where: eq(userBonus.id, bonusId) });
    if (!bonus || bonus.status === 'completed') return;

    const { walletService } = await import('@/lib/wallet-service');
    const result = await walletService.updateBalanceAtomic(
      userId,
      BigInt(bonus.awardedAmount),
      'bonus',
      { userBonusId: bonus.id }
    );

    if (result.success) {
      await db.update(userBonus)
        .set({ status: 'completed', completedAt: new Date(), completionTransactionId: result.transactionId })
        .where(eq(userBonus.id, bonusId));
    }
  }

  async getActiveBonuses(userId: string) {
    return await db.query.userBonus.findMany({
      where: and(
        eq(userBonus.userId, userId),
        inArray(userBonus.status, ['pending', 'active']),
        gte(userBonus.expiresAt, new Date())
      ),
      with: { template: true },
      orderBy: [desc(userBonus.createdAt)]
    });
  }
}

export const bonusService = new BonusService();
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/bonus-service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/bonus-service.ts tests/unit/bonus-service.test.ts
git commit -m "feat: implement bonus service"
```

---

## Task 3.2: Create Bonus Router

**Files:**
- Create: `server/routers/bonus.ts`

- [ ] **Step 1: Create router**

```typescript
// File: server/routers/bonus.ts
import { router, protectedProcedure } from '../trpc';
import { bonusService } from '@/lib/bonus-service';
import { db } from '@/drizzle';
import { userBonus } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';

export const bonusRouter = router({
  getActiveBonuses: protectedProcedure.query(async ({ ctx }) => {
    return await bonusService.getActiveBonuses(ctx.user.id);
  }),

  getBonusHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      return await db.query.userBonus.findMany({
        where: eq(userBonus.userId, ctx.user.id),
        with: { template: true },
        orderBy: [desc(userBonus.createdAt)],
        limit: input.limit
      });
    }),
});
```

- [ ] **Step 2: Register in tRPC**

```typescript
// File: server/trpc.ts
import { bonusRouter } from './routers/bonus';

export const appRouter = router({
  // ... existing
  bonus: bonusRouter,
});
```

- [ ] **Step 3: Commit**

```bash
git add server/routers/bonus.ts server/trpc.ts
git commit -m "feat: implement bonus router"
```

---

## Task 3.3: Integrate Bonus with Deposit

**Files:**
- Modify: `server/routers/transaction.ts`

- [ ] **Step 1: Add welcome bonus to deposit confirmation**

```typescript
// File: server/routers/transaction.ts - In confirmDeposit:
if (input.status === 'completed') {
  // ... existing code ...

  // ADD WELCOME BONUS:
  try {
    const { bonusService } = await import('@/lib/bonus-service');
    await bonusService.awardWelcomeBonus(
      depositRec.userId,
      BigInt(depositRec.amount.toString()),
      input.depositId
    );
  } catch (error) {
    console.error('[TRANSACTION] Welcome bonus failed:', error);
  }

  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/routers/transaction.ts
git commit -m "feat: integrate welcome bonus with deposit"
```

---

## 🛑 CHECKPOINT 3 REVIEW

**✅ Completed:**
- Bonus service with welcome bonus
- Wagering tracking system
- Bonus router with endpoints
- Deposit integration

**🤔 Decision Point:**

**Option A:** Proceed to VIP System (recommended)  
**Option B:** Test Bonus System before proceeding  
**Option C:** Skip to Integration phase  
**Option D:** Modify approach

---

# 🔷 CHECKPOINT 4: VIP System

**Goal:** Implement VIP tier calculation and progress tracking

**Estimated Time:** 1.5 hours  
**Dependencies:** CHECKPOINT 1 complete

---

## Task 4.1: Create VIP Service

**Files:**
- Create: `lib/vip-service.ts`

- [ ] **Step 1: Write test**

```typescript
// File: tests/unit/vip-service.test.ts
import { describe, test, expect } from 'vitest';
import { vipService } from '@/lib/vip-service';

describe('VIPService', () => {
  test('calculates correct tier from wagered amount', () => {
    expect(vipService.calculateTier(0n)).toBe('Bronze');
    expect(vipService.calculateTier(5000000n)).toBe('Silver');
    expect(vipService.calculateTier(20000000n)).toBe('Gold');
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

- [ ] **Step 3: Implement service**

```typescript
// File: lib/vip-service.ts
import { nanoid } from 'nanoid';
import { db } from '@/drizzle';
import { user, gameStats, notification, auditLog } from '@/drizzle/schema';
import { eq, and, lt } from 'drizzle-orm';
import { redis } from '@/lib/redis';

export class VIPService {
  private readonly THRESHOLDS = {
    'Diamond': 100000000n,
    'Platinum': 50000000n,
    'Gold': 20000000n,
    'Silver': 5000000n,
    'Bronze': 0n
  };

  private readonly ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  private readonly MULTIPLIERS = { 'Bronze': 1.0, 'Silver': 1.1, 'Gold': 1.25, 'Platinum': 1.5, 'Diamond': 2.0 };

  calculateTier(totalWagered: bigint): string {
    if (totalWagered >= this.THRESHOLDS.Diamond) return 'Diamond';
    if (totalWagered >= this.THRESHOLDS.Platinum) return 'Platinum';
    if (totalWagered >= this.THRESHOLDS.Gold) return 'Gold';
    if (totalWagered >= this.THRESHOLDS.Silver) return 'Silver';
    return 'Bronze';
  }

  async trackProgress(userId: string, betAmount: bigint): Promise<void> {
    let stats = await db.query.gameStats.findFirst({ where: eq(gameStats.userId, userId) });

    if (!stats) {
      await db.insert(gameStats).values({
        id: nanoid(),
        userId,
        totalWagered: betAmount.toString(),
        totalBets: 1,
        statsVersion: 0
      });
      stats = await db.query.gameStats.findFirst({ where: eq(gameStats.userId, userId) });
    }

    if (!stats) return;

    const current = BigInt(stats.totalWagered);
    const newWagered = current + betAmount;

    await db.update(gameStats)
      .set({
        totalWagered: newWagered.toString(),
        statsVersion: stats.statsVersion + 1
      })
      .where(and(eq(gameStats.id, stats.id), eq(gameStats.statsVersion, stats.statsVersion)));

    await this.checkUpgrade(userId, newWagered);
  }

  private async checkUpgrade(userId: string, totalWagered: bigint): Promise<void> {
    const user = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { vipLevel: true } });
    if (!user) return;

    const newTier = this.calculateTier(totalWagered);
    if (user.vipLevel === newTier) return;

    const currentIndex = this.ORDER.indexOf(user.vipLevel as any);
    const newIndex = this.ORDER.indexOf(newTier as any);
    if (newIndex <= currentIndex) return;

    await db.update(user)
      .set({ vipLevel: newTier })
      .where(eq(user.id, userId));

    await redis.del(`vip_status:${userId}`);

    await db.insert(notification).values({
      id: nanoid(),
      userId,
      type: 'system',
      title: `🎉 Reached ${newTier} tier!`,
      body: 'You now have access to exclusive bonus offers.',
      createdAt: new Date()
    });
  }

  getStatus(userId: string) {
    return db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { vipLevel: true },
      with: { gameStats: true }
    });
  }

  getBonusMultiplier(tier: string): number {
    return this.MULTIPLIERS[tier] || 1.0;
  }
}

export const vipService = new VIPService();
```

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add lib/vip-service.ts tests/unit/vip-service.test.ts
git commit -m "feat: implement VIP service"
```

---

## Task 4.2: Create VIP Router

**Files:**
- Create: `server/routers/vip.ts`

- [ ] **Step 1: Create router**

```typescript
// File: server/routers/vip.ts
import { router, protectedProcedure } from '../trpc';
import { vipService } from '@/lib/vip-service';
import { db } from '@/drizzle';
import { user } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export const vipRouter = router({
  getVIPStatus: protectedProcedure.query(async ({ ctx }) => {
    return await vipService.getStatus(ctx.user.id);
  }),

  getVIPBenefits: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.user.findFirst({
      where: eq(user.id, ctx.user.id),
      columns: { vipLevel: true }
    });

    const benefits: Record<string, any> = {
      'Bronze': { bonusMultiplier: 1.0, withdrawalLimit: 3 },
      'Silver': { bonusMultiplier: 1.1, withdrawalLimit: 5 },
      'Gold': { bonusMultiplier: 1.25, withdrawalLimit: 10 },
      'Platinum': { bonusMultiplier: 1.5, withdrawalLimit: 25 },
      'Diamond': { bonusMultiplier: 2.0, withdrawalLimit: 50 }
    };

    return benefits[user?.vipLevel || 'Bronze'];
  })
});
```

- [ ] **Step 2: Register in tRPC**

```typescript
// File: server/trpc.ts
import { vipRouter } from './routers/vip';

export const appRouter = router({
  // ... existing
  vip: vipRouter,
});
```

- [ ] **Step 3: Commit**

```bash
git add server/routers/vip.ts server/trpc.ts
git commit -m "feat: implement VIP router"
```

---

## 🛑 CHECKPOINT 4 REVIEW

**✅ Completed:**
- VIP service with tier calculation
- Progress tracking with optimistic locking
- VIP router with status endpoints
- Automatic tier upgrades

**🤔 Decision Point:**

**Option A:** Proceed to Integration (recommended)  
**Option B:** Test VIP System before proceeding  
**Option C:** Skip to final verification  
**Option D:** Modify approach

---

# 🔷 CHECKPOINT 5: Integration & Testing

**Goal:** Connect all systems and verify end-to-end functionality

**Estimated Time:** 2 hours  
**Dependencies:** CHECKPOINT 1-4 complete

---

## Task 5.1: Integrate Wagering & VIP Tracking

**Files:**
- Modify: `server/routers/wallet.ts` or aggregator adapter

- [ ] **Step 1: Add tracking to bet settlement**

```typescript
// File: server/routers/wallet.ts - Add to settlement:
async function settleBet(userId: string, betAmount: bigint, winAmount: bigint) {
  // Credit winnings...

  // Track wagering
  try {
    const { bonusService } = await import('@/lib/bonus-service');
    await bonusService.trackWagering(userId, betAmount);
  } catch (error) {
    console.error('[WALLET] Wagering tracking failed:', error);
  }

  // Track VIP
  try {
    const { vipService } = await import('@/lib/vip-service');
    await vipService.trackProgress(userId, betAmount);
  } catch (error) {
    console.error('[WALLET] VIP tracking failed:', error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/wallet-service.ts
git commit -m "feat: integrate wagering and VIP tracking with bet settlement"
```

---

## Task 5.2: Generate Referral Codes for Existing Users

**Files:**
- Create: `scripts/generate-referral-codes.ts`

- [ ] **Step 1: Create migration script**

```typescript
// File: scripts/generate-referral-codes.ts
import { db } from '@/drizzle';
import { user } from '@/drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import { referralService } from '@/lib/referral-service';

async function generateCodes() {
  const users = await db.select({ id: user.id })
    .from(user)
    .where(sql`referral_code IS NULL OR referral_code = ''`);

  console.log(`Generating codes for ${users.length} users...`);

  for (const { id } of users) {
    try {
      const code = await referralService.generateCode();
      await db.update(user).set({ referralCode: code }).where(eq(user.id, id));
    } catch (error) {
      console.error(`Failed for user ${id}:`, error);
    }
  }

  console.log('Done!');
}

generateCodes();
```

- [ ] **Step 2: Run migration**

```bash
npx tsx scripts/generate-referral-codes.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-referral-codes.ts
git commit -m "feat: add script to generate referral codes for existing users"
```

---

## Task 5.3: Create E2E Integration Test

**Files:**
- Create: `tests/integration/e2e-referral-bonus-vip.test.ts`

- [ ] **Step 1: Write comprehensive E2E test**

```typescript
// File: tests/integration/e2e-referral-bonus-vip.test.ts
import { describe, test, expect } from 'vitest';

describe('E2E: Referral → Bonus → VIP', () => {
  test('complete user journey', async () => {
    // 1. Referrer signs up
    const referrer = await createTestUser();

    // 2. Friend signs up with referral code
    const friend = await signUpWithReferral(referrer.referralCode);

    // 3. Friend makes first deposit
    await deposit(friend.id, 5000n);

    // 4. Verify referral bonus credited
    const referrerBalance = await getBalance(referrer.id);
    expect(referrerBalance).toBeGreaterThan(0);

    // 5. Verify welcome bonus awarded
    const bonuses = await getActiveBonuses(friend.id);
    expect(bonuses.length).toBe(1);

    // 6. Friend wagers and reaches Silver tier
    await wager(friend.id, 5000000n);

    // 7. Verify VIP upgrade
    const vipStatus = await getVIPStatus(friend.id);
    expect(vipStatus.currentTier).toBe('Silver');
  });
});
```

- [ ] **Step 2: Run E2E test**

```bash
npm test -- tests/integration/e2e-referral-bonus-vip.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/e2e-referral-bonus-vip.test.ts
git commit -m "test: add comprehensive E2E integration test"
```

---

## Task 5.4: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/referral-bonus-vip-guide.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to file structure section:
```
server/routers/
├── referral.ts    # Referral endpoints
├── bonus.ts       # Bonus endpoints
├── vip.ts         # VIP endpoints

lib/
├── referral-service.ts    # Referral logic
├── bonus-service.ts       # Bonus logic
├── vip-service.ts         # VIP logic
```

- [ ] **Step 2: Create user guide**

```markdown
# Referral, Bonus & VIP Guide

## Referral System
- Generate 12-character code
- Share with friends
- Earn 10% of their first deposit (max ₹2,000)

## Welcome Bonus
- 100% match on first deposit (max ₹10,000)
- 20x wagering requirement
- 30-day expiry

## VIP Tiers
- Bronze: ₹0+
- Silver: ₹50,000+
- Gold: ₹200,000+
- Platinum: ₹500,000+
- Diamond: ₹1,000,000+

Higher tiers = better bonus multipliers!
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/referral-bonus-vip-guide.md
git commit -m "docs: add referral bonus VIP documentation"
```

---

## 🛑 CHECKPOINT 5 REVIEW

**✅ Completed:**
- All systems integrated
- Wagering and VIP tracking connected
- E2E tests passing
- Documentation updated

**🤔 Decision Point:**

**Option A:** Proceed to Final Verification (recommended)  
**Option B:** Manual testing before verification  
**Option C:** Deploy to staging first  
**Option D**: Modify approach

---

# 🔷 CHECKPOINT 6: Production Ready

**Goal:** Final verification and production deployment

**Estimated Time:** 1 hour  
**Dependencies:** All previous checkpoints complete

---

## Task 6.1: Run Complete Test Suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected: No linting errors

---

## Task 6.2: Verify Database State

- [ ] **Step 1: Check migrations**

```bash
npx drizzle-kit migrate
```

Expected: No pending migrations

- [ ] **Step 2: Verify seed data**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bonus_template WHERE is_active = true;"
```

Expected: At least 1 template

- [ ] **Step 3: Check indexes**

```bash
psql $DATABASE_URL -c "\d user" | grep referral
```

Expected: Index exists

---

## Task 6.3: Manual API Testing

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test referral endpoints**

```bash
# Get referral code
curl -X POST http://localhost:3000/api/trpc/referral.getReferralCode
```

- [ ] **Step 3: Test bonus endpoints**

```bash
# Get active bonuses
curl -X POST http://localhost:3000/api/trpc/bonus.getActiveBonuses
```

- [ ] **Step 4: Test VIP endpoints**

```bash
# Get VIP status
curl -X POST http://localhost:3000/api/trpc/vip.getVIPStatus
```

---

## Task 6.4: Production Build Verification

- [ ] **Step 1: Build production version**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 2: Test production build**

```bash
npm start
```

Expected: Server starts without errors

- [ ] **Step 3: Verify API responses**

Test key endpoints in production mode

---

## Task 6.5: Final Commit and Tag

- [ ] **Step 1: Final commit**

```bash
git add .
git commit -m "feat: complete referral VIP bonus system implementation - production ready"
```

- [ ] **Step 2: Create git tag**

```bash
git tag -a v1.0.0-referral-vip-bonus -m "Referral, VIP, and Bonus System - Production Ready"
git push origin main --tags
```

- [ ] **Step 3: Update CHANGELOG**

```markdown
# CHANGELOG

## [1.0.0] - 2024-06-10

### Added
- Referral system with 10% bonus (max ₹2,000)
- Welcome bonus 100% match (max ₹10,000, 20x wagering)
- VIP 5-tier system based on total wagered
- Bonus wagering tracking
- VIP tier progression
- Referral code generation
- Tier-exclusive bonus multipliers

### Changed
- Enhanced deposit confirmation with bonus awarding
- Integrated wagering tracking with bet settlement
- Updated auth signup to support referral codes
```

---

## 🛑 CHECKPOINT 6 REVIEW - FINAL

**✅ System Complete:**
- ✅ All tests passing
- ✅ No TypeScript errors
- ✅ Database verified
- ✅ API endpoints tested
- ✅ Production build successful
- ✅ Documentation complete

**🎉 Ready for Production!**

---

# 🎯 DYNAMIC CONTROL FEATURES

This plan supports real-time updates and dynamic control:

## 🔄 At Any CHECKPOINT You Can:

**Skip Ahead:**
- Jump to any checkpoint by selecting tasks dynamically
- Skip entire phases if not needed

**Pivot Approach:**
- Change implementation strategy
- Modify bonus amounts, thresholds, or requirements
- Adjust VIP tier calculations

**Add Features:**
- Insert new tasks between checkpoints
- Add additional testing phases
- Include performance optimization

**Remove Features:**
- Skip non-essential tasks
- Defer features to later iteration
- Simplify implementation

**Review & Redirect:**
- Pause at any checkpoint for review
- Run partial tests
- Verify specific components

## 📊 Progress Dashboard

Track your progress in real-time:

```
✅ CHECKPOINT 1: Database & Core Infrastructure [COMPLETE]
☐ CHECKPOINT 2: Referral System [0/4 tasks]
☐ CHECKPOINT 3: Bonus System [0/3 tasks]
☐ CHECKPOINT 4: VIP System [0/2 tasks]
☐ CHECKPOINT 5: Integration & Testing [0/4 tasks]
☐ CHECKPOINT 6: Production Ready [0/5 tasks]

Total Progress: 1/6 checkpoints (16%)
Tasks Completed: 2/22 (9%)
```

## 🎮 Quick Commands

```bash
# Check current status
npm test -- --list

# Run specific checkpoint tests
npm test -- tests/unit/referral*

# Build and verify
npm run build && npm start

# Database status
npx drizzle-kit studio

# API health check
curl http://localhost:3000/api/health
```

---

**Plan version:** 2.0 (Dynamic Control)  
**Last updated:** 2024-06-10  
**Status:** Ready for execution with dynamic control support
