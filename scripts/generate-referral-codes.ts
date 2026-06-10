// File: scripts/generate-referral-codes.ts
import { db } from '@/drizzle';
import { user } from '@/drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import { referralService } from '@/lib/referral-service';

async function generateReferralCodes() {
  console.log('🌱 Generating referral codes for existing users...');

  const users = await db.select({ id: user.id })
    .from(user)
    .where(sql`referral_code IS NULL OR referral_code = ''`);

  console.log(`Found ${users.length} users without referral codes`);

  let processed = 0;
  let errors = 0;

  for (const { id } of users) {
    try {
      const code = await referralService.generateCode();

      await db.update(user)
        .set({ referralCode: code })
        .where(eq(user.id, id));

      processed++;

      if (processed % 100 === 0) {
        console.log(`✅ Processed ${processed}/${users.length} users...`);
      }
    } catch (error) {
      console.error(`❌ Failed for user ${id}:`, error);
      errors++;
    }
  }

  console.log(`\n✅ Generated ${processed} codes with ${errors} errors`);
}

// Run if called directly
if (require.main === module) {
  generateReferralCodes()
    .then(() => {
      console.log('\n✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
