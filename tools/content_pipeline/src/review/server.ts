import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import { loadReviewQueue, writeReviewDecision, writeReviewEdit } from './store.ts';

export type ReviewServerOptions = { runDir: string; host?: string; port?: number; open?: boolean; sessionTtlMs?: number; maxBodyBytes?: number };

const equal = (actual: string | undefined, expected: string): boolean => {
  if (!actual) return false;
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
const loopback = (host: string): boolean => host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);

function response(res: ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8') {
  const value = type.startsWith('application/json') ? JSON.stringify(body) : String(body);
  res.writeHead(status, { 'content-type': type, 'content-length': Buffer.byteLength(value), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cross-origin-resource-policy': 'same-origin' });
  res.end(value);
}

async function readBody(req: IncomingMessage, limit: number): Promise<any> {
  const declared = Number(req.headers['content-length'] ?? '0');
  if (Number.isFinite(declared) && declared > limit) throw Object.assign(new Error('body too large'), { status: 413 });
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('invalid JSON'), { status: 400 }); }
}

export async function startReviewServer(options: ReviewServerOptions) {
  const host = options.host ?? '127.0.0.1';
  if (!loopback(host)) throw new Error('review server may bind only to an OS loopback address');
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + (options.sessionTtlMs ?? 8 * 60 * 60_000);
  const maxBodyBytes = options.maxBodyBytes ?? 64 * 1024;
  let origin = '';
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', origin);
      if (url.pathname === '/' || url.pathname === '/index.html') return response(res, 200, await readFile(fileURLToPath(new URL('./ui/index.html', import.meta.url)), 'utf8'), 'text/html; charset=utf-8');
      if (url.pathname === '/review.js') return response(res, 200, await readFile(fileURLToPath(new URL('./ui/review.ts', import.meta.url)), 'utf8'), 'text/javascript; charset=utf-8');
      if (url.pathname === '/styles.css') return response(res, 200, await readFile(fileURLToPath(new URL('./ui/styles.css', import.meta.url)), 'utf8'), 'text/css; charset=utf-8');
      if (Date.now() >= expiresAt) return response(res, 401, { error: 'session expired' });
      if (!equal(req.headers['x-review-token'] as string | undefined, token)) return response(res, 401, { error: 'invalid review token' });
      if (url.pathname === '/api/session' && req.method === 'GET') return response(res, 200, { csrfToken, expiresAt });
      if (url.pathname === '/api/queue' && req.method === 'GET') return response(res, 200, await loadReviewQueue(options.runDir));
      if (req.method !== 'POST') return response(res, 404, { error: 'not found' });
      if (req.headers.origin !== origin || !equal(req.headers['x-csrf-token'] as string | undefined, csrfToken)) return response(res, 403, { error: 'origin or CSRF rejected' });
      if (req.headers['content-type']?.split(';')[0] !== 'application/json') return response(res, 415, { error: 'JSON required' });
      const match = /^\/api\/candidates\/([A-Za-z0-9._-]+)\/(decision|edit)$/.exec(url.pathname);
      if (!match) return response(res, 404, { error: 'not found' });
      const candidate = (await loadReviewQueue(options.runDir)).find((item) => item.id === match[1]);
      if (!candidate) return response(res, 404, { error: 'candidate not found' });
      const body = await readBody(req, maxBodyBytes);
      return response(res, 200, match[2] === 'decision' ? await writeReviewDecision(options.runDir, candidate, body) : await writeReviewEdit(options.runDir, candidate, body));
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 400;
      return response(res, status, { error: error instanceof Error ? error.message : 'request failed' });
    }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 0, host, resolve); });
  const address = server.address();
  if (!address || typeof address === 'string' || (isIP(address.address) && address.address !== '::1' && !address.address.startsWith('127.'))) {
    server.close(); throw new Error('operating system did not bind the review server to loopback');
  }
  origin = `http://${host.includes(':') ? `[${host}]` : host}:${address.port}`;
  return { origin, token, csrfToken, url: `${origin}/#token=${encodeURIComponent(token)}`, expiresAt, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}
