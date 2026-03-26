import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';

export async function registerWrongWordsRoutes(app: FastifyInstance) {
  app.get('/api/wrong-words', { preHandler: requireAuth }, async (req) => {
    const query = z
      .object({
        limit: z.coerce.number().default(50)
      })
      .parse(req.query);

    const userId = req.authUserId!;

    const items = await prisma.wrongWord.findMany({
      where: { userId },
      include: { word: true },
      orderBy: [{ count: 'desc' }, { createdAt: 'desc' }],
      take: query.limit
    });

    return {
      items: items.map((x) => ({
        id: x.id,
        userId: x.userId,
        wordId: x.wordId,
        count: x.count,
        createdAt: x.createdAt,
        lastReviewedAt: x.lastReviewedAt,
        word: x.word
      }))
    };
  });

  app.post('/api/wrong-words/add', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({
        wordId: z.string().min(1)
      })
      .parse(req.body);

    const userId = req.authUserId!;

    const item = await prisma.wrongWord.upsert({
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

    return { item };
  });

  app.post('/api/wrong-words/remove', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({
        wordId: z.string().min(1)
      })
      .parse(req.body);

    const userId = req.authUserId!;

    await prisma.wrongWord.deleteMany({
      where: {
        userId,
        wordId: body.wordId
      }
    });

    return { ok: true };
  });
}
