import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';

function dateStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function diffDays(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (24 * 3600 * 1000));
}

async function calcStreakDays(userId: string) {
  const rows = await prisma.dailyCheckin.findMany({
    where: { userId },
    orderBy: { date: 'asc' }
  });

  if (rows.length === 0) return 0;

  let streak = 1;
  for (let i = rows.length - 1; i > 0; i--) {
    const cur = new Date(rows[i].date + 'T00:00:00.000Z');
    const prev = new Date(rows[i - 1].date + 'T00:00:00.000Z');
    const d = diffDays(cur, prev);
    if (d === 1) {
      streak += 1;
      continue;
    }
    if (d > 1) break;
  }

  return streak;
}

export async function registerCheckinRoutes(app: FastifyInstance) {
  app.post('/api/checkin/today', { preHandler: requireAuth }, async (req) => {
    const userId = req.authUserId!;
    const today = dateStr();

    await prisma.dailyCheckin.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today
      },
      update: {}
    });

    const [totalCheckins, streakDays] = await Promise.all([
      prisma.dailyCheckin.count({ where: { userId } }),
      calcStreakDays(userId)
    ]);

    return {
      checkedToday: true,
      streakDays,
      totalCheckins
    };
  });

  app.get('/api/checkin/status', { preHandler: requireAuth }, async (req) => {
    const userId = req.authUserId!;
    const today = dateStr();

    const [todayEntry, totalCheckins, streakDays] = await Promise.all([
      prisma.dailyCheckin.findUnique({
        where: { userId_date: { userId, date: today } }
      }),
      prisma.dailyCheckin.count({ where: { userId } }),
      calcStreakDays(userId)
    ]);

    return {
      checkedToday: Boolean(todayEntry),
      streakDays,
      totalCheckins
    };
  });
}
