import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';

const scryptAsync = promisify(crypto.scrypt);

const SECRET = process.env.JWT_SECRET || 'demo-jwt-secret-change-me';
const EXPIRES_IN_SECONDS = 7 * 24 * 3600;

type TokenPayload = {
  userId: string;
  iat: number;
  exp: number;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(raw: string) {
  return crypto.createHmac('sha256', SECRET).update(raw).digest('base64url');
}

export function createToken(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    userId,
    iat: now,
    exp: now + EXPIRES_IN_SECONDS
  };

  const headerPart = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${headerPart}.${payloadPart}`;
  const signature = sign(unsigned);
  return `${unsigned}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signature] = parts;
  const unsigned = `${headerPart}.${payloadPart}`;
  const expected = sign(unsigned);

  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.userId || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived);
}

export function createOpaqueToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function readBearerToken(req: FastifyRequest) {
  const auth = req.headers.authorization;
  if (!auth) return null;

  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = readBearerToken(req);
  if (!token) {
    reply.code(401);
    return reply.send({ message: 'Unauthorized' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    reply.code(401);
    return reply.send({ message: 'Invalid token' });
  }

  req.authUserId = payload.userId;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;

  const user = await prisma.user.findUnique({
    where: { id: req.authUserId },
    select: { role: true }
  });

  if (!user || user.role !== 'ADMIN') {
    reply.code(403);
    return reply.send({ message: 'Forbidden: Admin access required' });
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    authUserId?: string;
  }
}
