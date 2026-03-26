import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedWords = [
  { text: 'habit', phonetic: '/ˈhæbɪt/', meaningZh: '习惯', example: 'Reading daily is a good habit.', level: 'A1', tags: ['daily'] },
  { text: 'review', phonetic: '/rɪˈvjuː/', meaningZh: '复习', example: 'I review words every night.', level: 'A1', tags: ['study'] },
  { text: 'improve', phonetic: '/ɪmˈpruːv/', meaningZh: '提高', example: 'Practice helps you improve.', level: 'A1', tags: ['growth'] },
  { text: 'context', phonetic: '/ˈkɒntekst/', meaningZh: '语境', example: 'Learn words in context.', level: 'A2', tags: ['method'] },
  { text: 'fluency', phonetic: '/ˈfluːənsi/', meaningZh: '流利度', example: 'Fluency comes with practice.', level: 'A2', tags: ['speaking'] },
  { text: 'strategy', phonetic: '/ˈstrætədʒi/', meaningZh: '策略', example: 'Find your own study strategy.', level: 'B1', tags: ['method'] }
];

function hashPasswordSync(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

async function main() {
  const demoHash = hashPasswordSync('123456');

  await prisma.user.upsert({
    where: { email: 'demo-user@example.com' },
    create: { email: 'demo-user@example.com', displayName: 'Demo User', role: 'USER', passwordHash: demoHash, emailVerifiedAt: new Date() },
    update: { displayName: 'Demo User', role: 'USER', passwordHash: demoHash, emailVerifiedAt: new Date() }
  });

  await prisma.user.upsert({
    where: { email: 'admin-demo@example.com' },
    create: { email: 'admin-demo@example.com', displayName: 'Admin Demo', role: 'ADMIN', passwordHash: demoHash, emailVerifiedAt: new Date() },
    update: { displayName: 'Admin Demo', role: 'ADMIN', passwordHash: demoHash, emailVerifiedAt: new Date() }
  });

  for (const w of seedWords) {
    await prisma.word.upsert({
      where: {
        text_level: {
          text: w.text,
          level: w.level
        }
      },
      update: w,
      create: w
    });
  }

  console.log('✅ Seed complete');
}

main().finally(() => prisma.$disconnect());
