import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { applySm2 } from '../services/srs.js';
import { requireAuth } from '../lib/auth.js';
import { getOrCreatePlan } from './plan.js';

function dateRangeToday() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function registerLearnRoutes(app: FastifyInstance) {
  app.get('/api/learn/due', { preHandler: requireAuth }, async (req) => {
    const query = z
      .object({
        limit: z.coerce.number().optional()
      })
      .parse(req.query);

    const userId = req.authUserId!;
    const now = new Date();
    const plan = await getOrCreatePlan(userId);

    const desiredTotal = query.limit ?? plan.dailyTarget;
    const reviewTarget = Math.min(plan.reviewWordsPerDay, desiredTotal);
    const newTarget = Math.min(plan.newWordsPerDay, Math.max(desiredTotal - reviewTarget, 0));

    const dueProgresses = await prisma.userWordProgress.findMany({
      where: {
        userId,
        dueAt: { lte: now }
      },
      include: { word: true },
      orderBy: { dueAt: 'asc' },
      take: reviewTarget
    });

    const learnedWordIds = (
      await prisma.userWordProgress.findMany({
        where: { userId },
        select: { wordId: true }
      })
    ).map((x) => x.wordId);

    const fresh = await prisma.word.findMany({
      where: {
        ...(learnedWordIds.length > 0 ? { id: { notIn: learnedWordIds } } : {})
      },
      take: Math.max(newTarget, desiredTotal - dueProgresses.length),
      orderBy: { createdAt: 'desc' }
    });

    const dueItems = dueProgresses.map((p) => ({ word: p.word, progress: p }));
    const newItems = fresh.map((w) => ({ word: w, progress: null }));
    const items = [...dueItems, ...newItems].slice(0, desiredTotal);

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
      items,
      plan: {
        dailyTarget: plan.dailyTarget,
        newWordsPerDay: plan.newWordsPerDay,
        reviewWordsPerDay: plan.reviewWordsPerDay
      },
      progress: {
        doneToday,
        dailyTarget: plan.dailyTarget
      }
    };
  });

  app.post('/api/learn/check', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({
        wordId: z.string(),
        quality: z.number().int().min(0).max(5)
      })
      .parse(req.body);

    const userId = req.authUserId!;

    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, displayName: userId },
      update: {}
    });

    const progress = await prisma.userWordProgress.upsert({
      where: { userId_wordId: { userId, wordId: body.wordId } },
      create: {
        userId,
        wordId: body.wordId,
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: new Date()
      },
      update: {}
    });

    const next = applySm2({
      easeFactor: progress.easeFactor,
      intervalDays: progress.intervalDays,
      repetitions: progress.repetitions,
      quality: body.quality
    });

    const nextDueAt = new Date(Date.now() + next.intervalDays * 24 * 3600 * 1000);

    const updated = await prisma.userWordProgress.update({
      where: { id: progress.id },
      data: {
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        mastered: next.mastered,
        lastQuality: body.quality,
        dueAt: nextDueAt
      }
    });

    await prisma.learningEvent.create({
      data: {
        userId,
        wordId: body.wordId,
        quality: body.quality
      }
    });

    if (body.quality < 3) {
      await prisma.wrongWord.upsert({
        where: { userId_wordId: { userId, wordId: body.wordId } },
        create: {
          userId,
          wordId: body.wordId,
          count: 1,
          lastReviewedAt: new Date()
        },
        update: {
          count: { increment: 1 },
          lastReviewedAt: new Date()
        }
      });
    }

    if (body.quality >= 4 && progress.lastQuality !== null && progress.lastQuality >= 4) {
      await prisma.wrongWord.deleteMany({
        where: {
          userId,
          wordId: body.wordId
        }
      });
    }

    return { item: updated };
  });
}
