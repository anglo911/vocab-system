import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAuthRoutes } from './routes/auth.js';
import { registerWordsRoutes } from './routes/words.js';
import { registerLearnRoutes } from './routes/learn.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerWrongWordsRoutes } from './routes/wrong-words.js';
import { registerCheckinRoutes } from './routes/checkin.js';
import { registerPlanRoutes } from './routes/plan.js';
import { registerAdminDashboardRoutes } from './routes/admin-dashboard.js';

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || process.env.API_PORT || 4000);

const corsOrigin = process.env.CORS_ORIGIN || true;
await app.register(cors, { origin: corsOrigin, credentials: true });

app.setErrorHandler((error, _req, reply) => {
  const statusCode = (error as any).statusCode || 500;
  const rawMessage = error instanceof Error ? error.message : 'Unknown error';
  const message = statusCode >= 500 ? 'Internal Server Error' : rawMessage;
  reply.code(statusCode).send({ message });
});

app.get('/health', async () => ({ ok: true }));

await registerAuthRoutes(app);
await registerWordsRoutes(app);
await registerLearnRoutes(app);
await registerStatsRoutes(app);
await registerWrongWordsRoutes(app);
await registerCheckinRoutes(app);
await registerPlanRoutes(app);
await registerAdminDashboardRoutes(app);

app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`API running at http://localhost:${port}`);
});
