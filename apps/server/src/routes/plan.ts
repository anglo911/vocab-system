import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';

function dateRangeToday() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getOrCreatePlan(userId: string) {
  return prisma.studyPlan.upsert({
    where: { userId },
    create: {
      userId,
      dailyTarget: 20,
      newWordsPerDay: 10,
      reviewWordsPerDay: 10
    },
    update: {}
  });
}

export async function registerPlanRoutes(app: FastifyInstance) {
  app.get('/api/plan', { preHandler: requireAuth }, async (req) => {
    const userId = req.authUserId!;
    const plan = await getOrCreatePlan(userId);
    const { start, end } = dateRangeToday();

    const doneToday = await prisma.learningEvent.count({
      where: {
        userId,
        createdAt: {
          gte: start,
          lt: end
        }
      }
    });

    return {
      plan,
      progress: {
        doneToday,
        dailyTarget: plan.dailyTarget
      }
    };
  });

  app.post('/api/plan', { preHandler: requireAuth }, async (req) => {
    const userId = req.authUserId!;
    const body = z
      .object({
        dailyTarget: z.number().int().min(1).max(500),
        newWordsPerDay: z.number().int().min(0).max(500),
        reviewWordsPerDay: z.number().int().min(0).max(500)
      })
      .parse(req.body);

    const plan = await prisma.studyPlan.upsert({
      where: { userId },
      create: { userId, ...body },
      update: body
    });

    const { start, end } = dateRangeToday();
    const doneToday = await prisma.learningEvent.count({
      where: {
        userId,
        createdAt: {
          gte: start,
          lt: end
        }
      }
    });

    return {
      plan,
      progress: {
        doneToday,
        dailyTarget: plan.dailyTarget
      }
    };
  });
}
