import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../lib/auth.js';

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function normalizeTags(raw: string) {
  if (!raw) return [];
  return raw
    .split(/[|，,]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function registerWordsRoutes(app: FastifyInstance) {
  app.get('/api/words', async (req) => {
    const query = z
      .object({
        level: z.string().optional(),
        search: z.string().optional(),
        limit: z.coerce.number().default(50)
      })
      .parse(req.query);

    const words = await prisma.word.findMany({
      where: {
        ...(query.level ? { level: query.level } : {}),
        ...(query.search
          ? {
              OR: [{ text: { contains: query.search, mode: 'insensitive' } }, { meaningZh: { contains: query.search } }]
            }
          : {})
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit
    });

    return { items: words };
  });

  app.post('/api/admin/words', { preHandler: requireAdmin }, async (req, reply) => {
    const body = z
      .object({
        text: z.string().min(1),
        phonetic: z.string().optional(),
        meaningZh: z.string().min(1),
        example: z.string().optional(),
        level: z.string().default('A1'),
        tags: z.array(z.string()).default([])
      })
      .parse(req.body);

    const created = await prisma.word.create({ data: body });
    reply.code(201);
    return { item: created };
  });

  app.post('/api/admin/words/import-csv', { preHandler: requireAdmin }, async (req, reply) => {
    const userId = req.authUserId!;
    const body = z
      .object({
        csvText: z.string().optional(),
        fileBase64: z.string().optional(),
        source: z.string().default('csv-upload')
      })
      .refine((x) => Boolean(x.csvText || x.fileBase64), 'csvText or fileBase64 is required')
      .parse(req.body);

    const csvText = body.csvText ?? Buffer.from(body.fileBase64!, 'base64').toString('utf8');
    const lines = csvText
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    // 创建 import job
    const importJob = await prisma.importJob.create({
      data: {
        userId,
        source: body.source,
        totalRows: Math.max(0, lines.length - 1),
        status: 'running'
      }
    });

    const updateJob = async (data: Partial<typeof importJob>) => {
      await prisma.importJob.update({
        where: { id: importJob.id },
        data
      });
    };

    if (lines.length < 2) {
      await updateJob({
        status: 'failed',
        failedCount: 1,
        errorLog: 'CSV 数据不足，至少包含表头和一行数据',
        completedAt: new Date()
      });
      return {
        createdCount: 0,
        updatedCount: 0,
        failedRows: [{ row: 1, reason: 'CSV 数据不足，至少包含表头和一行数据' }],
        jobId: importJob.id
      };
    }

    const headers = parseCsvLine(lines[0]);
    const index = {
      text: headers.indexOf('text'),
      phonetic: headers.indexOf('phonetic'),
      meaningZh: headers.indexOf('meaningZh'),
      example: headers.indexOf('example'),
      level: headers.indexOf('level'),
      tags: headers.indexOf('tags')
    };

    const mustHave = ['text', 'meaningZh', 'level'] as const;
    for (const key of mustHave) {
      if (index[key] < 0) {
        await updateJob({
          status: 'failed',
          failedCount: 1,
          errorLog: `缺少列：${key}`,
          completedAt: new Date()
        });
        return {
          createdCount: 0,
          updatedCount: 0,
          failedRows: [{ row: 1, reason: `缺少列：${key}` }],
          jobId: importJob.id
        };
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    const failedRows: { row: number; reason: string }[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const rowNum = i + 1;
      const cols = parseCsvLine(lines[i]);

      const text = (cols[index.text] || '').trim();
      const meaningZh = (cols[index.meaningZh] || '').trim();
      const level = (cols[index.level] || '').trim();

      if (!text || !meaningZh || !level) {
        failedRows.push({ row: rowNum, reason: 'text/meaningZh/level 不能为空' });
        continue;
      }

      const phonetic = index.phonetic >= 0 ? (cols[index.phonetic] || '').trim() : '';
      const example = index.example >= 0 ? (cols[index.example] || '').trim() : '';
      const tags = index.tags >= 0 ? normalizeTags(cols[index.tags] || '') : [];

      try {
        const existing = await prisma.word.findUnique({
          where: {
            text_level: { text, level }
          }
        });

        if (existing) {
          await prisma.word.update({
            where: { id: existing.id },
            data: {
              text,
              phonetic: phonetic || null,
              meaningZh,
              example: example || null,
              level,
              tags
            }
          });
          updatedCount += 1;
        } else {
          await prisma.word.create({
            data: {
              text,
              phonetic: phonetic || null,
              meaningZh,
              example: example || null,
              level,
              tags
            }
          });
          createdCount += 1;
        }
      } catch (e: any) {
        failedRows.push({
          row: rowNum,
          reason: e?.message || '导入失败'
        });
      }
    }

    // 更新 import job 完成状态
    await updateJob({
      status: failedRows.length > 0 ? 'partial' : 'completed',
      createdCount,
      updatedCount,
      failedCount: failedRows.length,
      errorLog: failedRows.length > 0 ? JSON.stringify(failedRows.slice(0, 10)) : null,
      completedAt: new Date()
    });

    return {
      createdCount,
      updatedCount,
      failedRows,
      jobId: importJob.id
    };
  });
}
