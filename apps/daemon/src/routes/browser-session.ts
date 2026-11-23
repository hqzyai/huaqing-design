import { randomBytes } from 'node:crypto';
import type { Express, Request } from 'express';
import { apiTokenAuthorizationMatches } from '../api-token-auth.js';
import { isLoopbackPeerAddress } from '../http/local-daemon-request.js';

const COOKIE = 'hq_design_session';
const TTL = 8 * 60 * 60 * 1000;
const LIMIT = 1024;

/** Browser cookies are revocable and never expose the daemon's API token. */
export function registerBrowserLoginRoutes(
  app: Express,
  config: {
    enabled: boolean;
    apiToken: string;
    basicUsername: string;
  },
) {
  const sessions = new Map<string, number>();
  const attempts = new Map<string, { count: number; until: number }>();
  const cookieToken = (req: Request) => {
    const value = req.headers.cookie
      ?.split(';')
      .find((part) => part.trim().startsWith(`${COOKIE}=`));
    return value?.trim().slice(COOKIE.length + 1) ?? '';
  };
  const sameOrigin = (req: Request) => {
    if (req.get('sec-fetch-site') === 'cross-site') return false;
    const origin = req.get('origin');
    if (!origin)
      return (
        !req.get('sec-fetch-site') ||
        req.get('sec-fetch-site') === 'same-origin'
      );
    try {
      return new URL(origin).host === req.get('host');
    } catch {
      return false;
    }
  };
  const prune = () => {
    const now = Date.now();
    for (const [key, expiry] of sessions)
      if (expiry <= now) sessions.delete(key);
    for (const [key, attempt] of attempts)
      if (attempt.until <= now) attempts.delete(key);
  };
  const authenticated = (req: Request) =>
    (sessions.get(cookieToken(req)) ?? 0) > Date.now();
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, path: '/' };
  app.get('/api/auth/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    // Preserve the existing desktop/local-daemon mode with no browser login.
    const enabled =
      config.enabled && !isLoopbackPeerAddress(req.socket.remoteAddress);
    res.json({ enabled, authenticated: !enabled || authenticated(req) });
  });
  app.post('/api/auth/login', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!config.enabled)
      return res.status(409).json({ message: '此实例未启用网页登录' });
    if (!sameOrigin(req))
      return res.status(403).json({ message: '请从本站登录页面操作' });
    prune();
    const key = req.socket.remoteAddress ?? 'unknown';
    const attempt = attempts.get(key) ?? {
      count: 0,
      until: Date.now() + 60_000,
    };
    if (attempt.count >= 10)
      return res.status(429).json({ message: '尝试次数过多，请一分钟后重试' });
    const { username, password } = req.body ?? {};
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.length > 512 ||
      password.length > 8192 ||
      !apiTokenAuthorizationMatches(
        `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        config.apiToken,
        config.basicUsername,
      )
    ) {
      attempt.count++;
      if (attempts.size >= LIMIT && !attempts.has(key))
        attempts.delete(attempts.keys().next().value!);
      attempts.set(key, attempt);
      return res.status(401).json({ message: '账号或密码不正确' });
    }
    attempts.delete(key);
    sessions.delete(cookieToken(req));
    if (sessions.size >= LIMIT) sessions.delete(sessions.keys().next().value!);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + TTL);
    res.cookie(COOKIE, token, {
      ...cookieOptions,
      secure: req.secure || req.get('x-forwarded-proto') === 'https',
      maxAge: TTL,
    });
    return res.json({ authenticated: true });
  });
  app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!sameOrigin(req))
      return res.status(403).json({ message: '请从本站退出登录' });
    sessions.delete(cookieToken(req));
    res.clearCookie(COOKIE, cookieOptions);
    return res.json({ authenticated: false });
  });
  return {
    accepts(req: Request) {
      return (
        authenticated(req) &&
        (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || sameOrigin(req))
      );
    },
  };
}
