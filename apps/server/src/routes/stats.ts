import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';

function lastNDates(n: number) {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export async function registerStatsRoutes(app: FastifyInstance) {
  app.get('/api/stats/overview', { preHandler: requireAuth }, async (req) => {
    const userId = req.authUserId!;

    const [progressCount, masteredCount, eventCount, recentEvents, wrongWordsCount, user] = await Promise.all([
      prisma.userWordProgress.count({ where: { userId } }),
      prisma.userWordProgress.count({ where: { userId, mastered: true } }),
      prisma.learningEvent.count({ where: { userId } }),
      prisma.learningEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.wrongWord.count({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true, emailVerifiedAt: true, createdAt: true } })
    ]);

    const accuracy = recentEvents.length
      ? Math.round((recentEvents.filter((e) => e.quality >= 3).length / recentEvents.length) * 100)
      : 0;

    const days = lastNDates(7);
    const trendMap = new Map<string, number>(days.map((d) => [d, 0]));
    for (const evt of recentEvents) {
      const key = evt.createdAt.toISOString().slice(0, 10);
      if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) || 0) + 1);
    }

    return {
      user,
      progressCount,
      masteredCount,
      eventCount,
      recentAccuracy: accuracy,
      wrongWordsCount,
      dailyTrend7d: Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))
    };
  });
}
