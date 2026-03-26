import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth.js';

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateRangeToday() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function registerAdminDashboardRoutes(app: FastifyInstance) {
  app.get('/api/admin/dashboard', { preHandler: requireAdmin }, async () => {
    const { start, end } = dateRangeToday();

    const [totalUsers, totalWords, todayLearningEvents, todayCheckins, recentEvents] = await Promise.all([
      prisma.user.count(),
      prisma.word.count(),
      prisma.learningEvent.count({
        where: {
          createdAt: { gte: start, lt: end }
        }
      }),
      prisma.dailyCheckin.count({
        where: {
          date: dayKey(start)
        }
      }),
      prisma.learningEvent.findMany({
        where: {
          createdAt: {
            gte: new Date(start.getTime() - 6 * 24 * 3600 * 1000),
            lt: end
          }
        },
        select: { createdAt: true }
      })
    ]);

    const trendMap = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(start);
      d.setDate(d.getDate() - i);
      trendMap.set(dayKey(d), 0);
    }

    for (const evt of recentEvents) {
      const key = dayKey(evt.createdAt);
      if (!trendMap.has(key)) continue;
      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    }

    return {
      totalUsers,
      totalWords,
      todayLearningEvents,
      todayCheckins,
      trend7d: Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))
    };
  });

  // 获取导入任务列表
  app.get('/api/admin/import-jobs', { preHandler: requireAdmin }, async (req) => {
    const query = z
      .object({
        limit: z.coerce.number().default(20),
        offset: z.coerce.number().default(0)
      })
      .parse(req.query);

    const [items, total] = await Promise.all([
      prisma.importJob.findMany({
        orderBy: { startedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: {
          user: {
            select: { id: true, displayName: true }
          }
        }
      }),
      prisma.importJob.count()
    ]);

    return { items, total };
  });
}
