import Fastify, { type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import {
  claimDailyBonus,
  getFeed,
  getHallOfFame,
  getLeaderboard,
  getPlayerState,
  getStats,
  HttpError,
  joinPlayer,
  listPlayers,
  onFeed,
  spin,
  updateProfile,
} from './service.ts';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

function playerId(req: FastifyRequest): number {
  const id = Number(req.headers['x-player-id']);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(401, 'Missing player');
  return id;
}

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
  app.log.error(err);
  return reply.status(500).send({ error: 'Something went wrong' });
});

type Body = Record<string, unknown>;

app.get('/api/health', async () => ({ ok: true }));
app.get('/api/players', async () => listPlayers());
app.post<{ Body: Body }>('/api/players', async (req) => joinPlayer(req.body ?? {}));
app.get('/api/me', async (req) => getPlayerState(playerId(req)));
app.patch<{ Body: Body }>('/api/me', async (req) => updateProfile(playerId(req), req.body ?? {}));
app.post('/api/bonus', async (req) => claimDailyBonus(playerId(req)));
app.post<{ Body: Body }>('/api/spin', async (req) => spin(playerId(req), req.body ?? {}));
app.get<{ Params: { id: string } }>('/api/stats/:id', async (req) => getStats(Number(req.params.id)));
app.get('/api/leaderboard', async () => getLeaderboard());
app.get('/api/halloffame', async () => getHallOfFame());
app.get('/api/feed', async () => getFeed());

// Server-sent events: live big wins and jackpots from every player.
app.get('/api/events', (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  reply.raw.write(': connected\n\n');
  const off = onFeed((event) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`));
  const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
  req.raw.on('close', () => {
    off();
    clearInterval(ping);
  });
});

// Serve the built client in production.
const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'Not found' });
    return reply.sendFile('index.html');
  });
}

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
