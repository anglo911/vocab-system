import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createOpaqueToken, createToken, hashPassword, verifyPassword } from '../lib/auth.js';

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  displayName: z.string().trim().min(1).max(50)
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      reply.code(409);
      return { message: 'Email already registered' };
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: body.displayName,
        role: 'USER'
      }
    });

    const verifyToken = createOpaqueToken();
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
      }
    });

    reply.code(201);
    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        emailVerified: false
      },
      verificationToken: verifyToken,
      verificationHint: '开发阶段先直接返回 token；后续可接 SMTP/邮件服务发送验证邮件。'
    };
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      reply.code(401);
      return { message: 'Invalid email or password' };
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      reply.code(401);
      return { message: 'Invalid email or password' };
    }

    const token = createToken(user.id);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        emailVerified: Boolean(user.emailVerifiedAt)
      }
    };
  });

  app.post('/api/auth/verify-email', async (req, reply) => {
    const body = z.object({ token: z.string().min(1) }).parse(req.body);
    const record = await prisma.verificationToken.findUnique({ where: { token: body.token } });

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      reply.code(400);
      return { message: 'Invalid or expired verification token' };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() }
      }),
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() }
      })
    ]);

    return { ok: true };
  });

  app.post('/api/auth/forgot-password', async (req) => {
    const body = z.object({ email: z.string().trim().email() }).parse(req.body);
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { ok: true };
    }

    const resetToken = createOpaqueToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      }
    });

    return {
      ok: true,
      resetToken,
      resetHint: '开发阶段先直接返回 token；后续可接 SMTP/邮件服务发送重置邮件。'
    };
  });

  app.post('/api/auth/reset-password', async (req, reply) => {
    const body = z.object({ token: z.string().min(1), password: z.string().min(6) }).parse(req.body);
    const record = await prisma.passwordResetToken.findUnique({ where: { token: body.token } });

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      reply.code(400);
      return { message: 'Invalid or expired reset token' };
    }

    const passwordHash = await hashPassword(body.password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() }
      })
    ]);

    return { ok: true };
  });
}
