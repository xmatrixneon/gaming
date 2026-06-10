// File: drizzle/seed/seed-bonus-templates.ts
import { db } from '@/drizzle';
import { bonusTemplate } from '@/drizzle/schema';

export async function seedBonusTemplates() {
  console.log('🌱 Seeding bonus templates...');

  const templates = [
    {
      id: 'welcome-bonus-100',
      name: 'Welcome Bonus 100% Match',
      description: 'Get 100% bonus on your first deposit up to ₹10,000',
      type: 'welcome' as const,
      value: '100',
      maxValue: '100000', // ₹10,000 in paisa
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

  console.log(`✅ Seeded ${templates.length} bonus templates`);
}

// Run if called directly
if (require.main === module) {
  seedBonusTemplates()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}
