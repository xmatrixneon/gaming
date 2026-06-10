/**
 * Balance Reconciliation Script
 *
 * Critical for financial correctness.
 *
 * This script compares the cached user.balance against the calculated balance
 * from the transaction ledger (source of truth). Any discrepancies are reported
 * and can be auto-corrected within a threshold.
 *
 * Run periodically (daily/hourly) to detect drift from bugs, race conditions,
 * or manual database changes.
 *
 * Usage:
 *   npx tsx scripts/reconcile-balances.ts [--dry-run] [--auto-fix-threshold=100]
 */

import { db } from '@/drizzle';
import { user, transaction } from '@/drizzle/schema';
import { eq, sql, and } from 'drizzle-orm';

interface ReconciliationResult {
  userId: string;
  cachedBalance: string;
  calculatedBalance: string;
  difference: string;
  differenceAbs: bigint;
  status: 'ok' | 'drift_detected' | 'auto_fixed' | 'manual_review_required';
}

interface ReconciliationSummary {
  totalUsers: number;
  ok: number;
  driftDetected: number;
  autoFixed: number;
  manualReviewRequired: number;
  issues: ReconciliationResult[];
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const autoFixThreshold = Number(
  args.find(arg => arg.startsWith('--auto-fix-threshold='))?.split('=')[1] ?? '100'
);

/**
 * Calculate the correct balance from the transaction ledger.
 * Only includes completed transactions - this is the source of truth.
 */
async function calculateBalance(userId: string): Promise<bigint> {
  const result = await db
    .select({
      total: sql<string>`coalesce(sum(amount), '0')::text`,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.status, 'completed')
      )
    );

  return BigInt(result[0]?.total ?? '0');
}

/**
 * Reconcile a single user's balance.
 */
async function reconcileUser(userId: string): Promise<ReconciliationResult> {
  const userRecord = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { balance: true },
  });

  if (!userRecord) {
    throw new Error(`User ${userId} not found`);
  }

  const cachedBalance = BigInt(userRecord.balance);
  const calculatedBalance = await calculateBalance(userId);
  const difference = cachedBalance - calculatedBalance;
  const differenceAbs = difference < 0n ? -difference : difference;

  const result: ReconciliationResult = {
    userId,
    cachedBalance: cachedBalance.toString(),
    calculatedBalance: calculatedBalance.toString(),
    difference: difference.toString(),
    differenceAbs,
    status: 'ok',
  };

  if (difference === 0n) {
    return result;
  }

  result.status = 'drift_detected';

  // Auto-fix within threshold (in paisa: default 100 = ₹1.00)
  if (!dryRun && differenceAbs <= BigInt(autoFixThreshold)) {
    await db
      .update(user)
      .set({ balance: calculatedBalance.toString() })
      .where(eq(user.id, userId));

    result.status = 'auto_fixed';
    console.log(`  ✅ Auto-fixed: user ${userId}, drift: ${difference / 100n} rupees`);
  } else {
    result.status = 'manual_review_required';
  }

  return result;
}

/**
 * Reconcile all user balances.
 */
async function reconcileAllUsers(): Promise<ReconciliationSummary> {
  console.log('🔍 Starting balance reconciliation...');
  console.log(`   Dry run: ${dryRun}`);
  console.log(`   Auto-fix threshold: ₹${autoFixThreshold / 100}`);
  console.log();

  const allUsers = await db.select({ id: user.id }).from(user);

  const issues: ReconciliationResult[] = [];
  const summary: ReconciliationSummary = {
    totalUsers: allUsers.length,
    ok: 0,
    driftDetected: 0,
    autoFixed: 0,
    manualReviewRequired: 0,
    issues,
  };

  for (const { id } of allUsers) {
    const result = await reconcileUser(id);

    if (result.status === 'ok') {
      summary.ok++;
    } else {
      summary.driftDetected++;
      summary.issues.push(result);

      if (result.status === 'auto_fixed') {
        summary.autoFixed++;
      } else if (result.status === 'manual_review_required') {
        summary.manualReviewRequired++;
      }
    }

    // Progress indicator every 100 users
    if ((summary.ok + summary.driftDetected) % 100 === 0) {
      process.stdout.write(`\r   Processed: ${summary.ok + summary.driftDetected}/${allUsers.length}`);
    }
  }

  console.log(`\r   Processed: ${allUsers.length}/${allUsers.length}`);
  return summary;
}

/**
 * Print reconciliation report.
 */
function printReport(summary: ReconciliationSummary): void {
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RECONCILIATION REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log(`Total users:         ${summary.totalUsers}`);
  console.log(`✓ OK:                 ${summary.ok}`);
  console.log(`⚠ Drift detected:     ${summary.driftDetected}`);
  console.log(`  - Auto-fixed:       ${summary.autoFixed}`);
  console.log(`  - Manual review:     ${summary.manualReviewRequired}`);

  if (summary.manualReviewRequired > 0) {
    console.log();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('MANUAL REVIEW REQUIRED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log();

    for (const issue of summary.issues.filter(i => i.status === 'manual_review_required')) {
      const diffRupees = issue.differenceAbs / 100n;
      console.log(`User: ${issue.userId}`);
      console.log(`  Cached:    ₹${issue.cachedBalance}`);
      console.log(`  Calculated: ₹${issue.calculatedBalance}`);
      console.log(`  Drift:     ${issue.difference < '0' ? '-' : ''}₹${diffRupees}`);
      console.log();
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
}

// Run if called directly
if (require.main === module) {
  reconcileAllUsers()
    .then(summary => {
      printReport(summary);

      if (summary.manualReviewRequired > 0) {
        process.exit(1); // Exit with error if manual review needed
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Reconciliation failed:', error);
      process.exit(1);
    });
}
