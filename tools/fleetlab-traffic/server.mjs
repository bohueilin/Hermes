import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { computeEstimate, TrafficError, validateEstimate } from './google-routes.mjs';

const FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']], ['/privacy', ['privacy.html', 'text/html; charset=utf-8']],
  ['/terms', ['terms.html', 'text/html; charset=utf-8']],
  ['/google-maps-logo.svg', ['google-maps-logo.svg', 'image/svg+xml']],
]);
const LIMITS = Object.freeze({concurrent: 1, perMinute: 6, perSession: 30, bodyBytes: 4096, futureDays: 7});
const HEADERS = {
  'Cache-Control': 'no-store, max-age=0', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
function fail(code, message, status) { return new TrafficError(code, message, status); }
async function readBody(req) {
  const declared = req.headers['content-length'];
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > LIMITS.bodyBytes)) throw fail('BODY_TOO_LARGE', 'Request exceeds 4 KB.', 413);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > LIMITS.bodyBytes) throw fail('BODY_TOO_LARGE', 'Request exceeds 4 KB.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw fail('INVALID_INPUT', 'Request must contain valid JSON.', 400); }
}
export async function startTrafficServer({host = '127.0.0.1', port = 8768, apiKey = process.env.GOOGLE_MAPS_API_KEY ?? '', fetchImpl = globalThis.fetch, now = Date.now} = {}) {
  if (host !== '127.0.0.1') throw new Error('Only loopback 127.0.0.1 is supported.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid local port.');
  // Only static assets are read here; no request-controlled paths or provider content are stored.
  const assets = new Map(await Promise.all([...FILES].map(async ([path, [file, type]]) => [path, {body: await readFile(new URL(`public/${file}`, import.meta.url)), type}])));
  let active = 0;
  let total = 0;
  let attempts = [];
  const server = http.createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, {...HEADERS, 'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
    try {
      const authority = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== authority || req.socket.remoteAddress !== '127.0.0.1') throw fail('LOCAL_ONLY', 'Use the exact local companion address.', 403);
      if (req.headers.origin && req.headers.origin !== `http://${authority}`) throw fail('LOCAL_ONLY', 'Cross-origin requests are not allowed.', 403);
      if (!['GET', 'POST'].includes(req.method)) throw fail('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
      if (req.method === 'GET' && req.url === '/api/status') {
        json(200, {state: apiKey.trim() ? 'configured' : 'unconfigured', message: apiKey.trim() ? 'Key configured; connection has not been tested. Request one estimate to connect.' : 'Server-side key is absent. No Google Maps requests can run.', limits: LIMITS, requestsUsed: total});
      } else if (req.method === 'GET' && assets.has(req.url)) {
        const {body, type} = assets.get(req.url); res.writeHead(200, {...HEADERS, 'Content-Type': type}); res.end(body);
      } else if (req.method === 'POST' && req.url === '/api/estimate') {
        if (req.headers.origin !== `http://${authority}`) throw fail('LOCAL_ONLY', 'A same-origin browser request is required.', 403);
        if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) throw fail('CONTENT_TYPE', 'Use application/json.', 415);
        const input = validateEstimate(await readBody(req), now());
        if (!apiKey.trim()) throw fail('UNCONFIGURED', 'No server-side key is configured. No request was sent.', 503);
        attempts = attempts.filter(time => time > now() - 60000);
        if (active >= LIMITS.concurrent || attempts.length >= LIMITS.perMinute || total >= LIMITS.perSession) throw fail('RATE_LIMIT', 'Request limit reached: one at a time, six per minute, thirty per server session.', 429);
        active++; total++; attempts.push(now());
        try { json(200, await computeEstimate(input, {apiKey, fetchImpl, now})); }
        finally { active--; }
      } else json(404, {state: 'error', code: 'NOT_FOUND', message: 'Not found.'});
    } catch (error) {
      const safe = error instanceof TrafficError ? error : fail('SERVER_ERROR', 'The local companion could not complete the request.', 500);
      if (!res.headersSent && !res.destroyed) json(safe.status, {state: safe.code === 'UNCONFIGURED' ? 'unconfigured' : 'error', code: safe.code, message: safe.message});
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.timeout = 15000;
  server.maxHeadersCount = 32;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return {server, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); })};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startTrafficServer().then(({origin}) => process.stdout.write(`FleetLab optional traffic companion: ${origin}\nNo estimate is requested until you submit the form.\n`)).catch(() => {
    process.stderr.write('Could not start local companion. Check that port 8768 is available.\n'); process.exitCode = 1;
  });
}
