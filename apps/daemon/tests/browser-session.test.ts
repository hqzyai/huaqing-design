import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerBrowserLoginRoutes } from '../src/routes/browser-session.js';

let server: Server;
let origin: string;
const credentials = { username: 'operator', password: 'fixture-password' };
async function send(
  path: string,
  body?: unknown,
  cookie?: string,
  headers: Record<string, string> = {},
) {
  return fetch(`${origin}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined
        ? {}
        : { 'Content-Type': 'application/json', Origin: origin }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function login() {
  const response = await send('auth/login', credentials);
  expect(response.status).toBe(200);
  return response.headers.get('set-cookie')!.split(';')[0]!;
}
beforeEach(async () => {
  const app = express();
  app.use(express.json());
  const auth = registerBrowserLoginRoutes(app, {
    enabled: true,
    apiToken: credentials.password,
    basicUsername: credentials.username,
  });
  app.all('/api/private', (req, res) =>
    res.status(auth.accepts(req) ? 200 : 401).json({ ok: auth.accepts(req) }),
  );
  server = createServer(app);
  server.prependListener('connection', (socket) =>
    Object.defineProperty(socket, 'remoteAddress', {
      value: '172.18.0.2',
      configurable: true,
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('browser login and revocable logout', () => {
  it('requires login without disclosing credentials', async () => {
    expect(await (await send('auth/session')).json()).toEqual({
      enabled: true,
      authenticated: false,
    });
    expect((await send('private')).status).toBe(401);
    const wrong = await send('auth/login', {
      ...credentials,
      password: 'incorrect',
    });
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get('set-cookie')).toBeNull();
  });
  it('issues an HttpOnly session, authenticates requests and keeps passwords out of cookies', async () => {
    const response = await send('auth/login', credentials);
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain(credentials.password);
    expect(
      (await send('private', undefined, cookie.split(';')[0])).status,
    ).toBe(200);
    expect(
      await (
        await send('auth/session', undefined, cookie.split(';')[0])
      ).json(),
    ).toEqual({ enabled: true, authenticated: true });
  });
  it('revokes the old cookie on logout and prevents replay', async () => {
    const cookie = await login();
    expect((await send('auth/logout', {}, cookie)).status).toBe(200);
    expect((await send('private', undefined, cookie)).status).toBe(401);
    expect(
      (await send('auth/session', undefined, cookie)).headers.get(
        'cache-control',
      ),
    ).toBe('no-store');
  });
  it('rotates an existing browser session on another successful login', async () => {
    const oldCookie = await login();
    const response = await send('auth/login', credentials, oldCookie);
    expect(response.headers.get('set-cookie')).not.toContain(oldCookie);
    expect((await send('private', undefined, oldCookie)).status).toBe(401);
  });
  it('rejects cross-origin login, logout and cookie-authenticated writes', async () => {
    const cookie = await login();
    for (const action of ['auth/login', 'auth/logout']) {
      expect(
        (
          await send(action, credentials, cookie, {
            Origin: 'https://other.invalid',
          })
        ).status,
      ).toBe(403);
    }
    expect(
      (await send('private', {}, cookie, { Origin: 'https://other.invalid' }))
        .status,
    ).toBe(401);
    expect((await send('private', {}, cookie)).status).toBe(200);
  });
  it('expires sessions after eight hours', async () => {
    const cookie = await login();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 8 * 60 * 60 * 1000 + 1);
    expect((await send('private', undefined, cookie)).status).toBe(401);
  });
  it('rate limits repeated bad passwords', async () => {
    for (let i = 0; i < 10; i++)
      expect(
        (await send('auth/login', { ...credentials, password: 'bad' })).status,
      ).toBe(401);
    expect((await send('auth/login', credentials)).status).toBe(429);
  });
  it('marks the session Secure behind an HTTPS proxy', async () => {
    const response = await send('auth/login', credentials, undefined, {
      'X-Forwarded-Proto': 'https',
    });
    expect(response.headers.get('set-cookie')).toContain('Secure');
  });
});
