import { readCookie, readSessionToken, SESSION_COOKIE, type SessionUser } from './session';

type EnvLike = Record<string, unknown> | undefined;

export interface AuthConfig {
  githubClientId: string;
  githubClientSecret: string;
  sessionSecret: string;
}

function readEnv(env: EnvLike, key: string): string | undefined {
  const fromBinding = env?.[key];

  if (typeof fromBinding === 'string' && fromBinding) {
    return fromBinding;
  }

  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;

  return fromProcess || undefined;
}

/**
 * Sign-in is enabled only when all three variables are set; otherwise the app
 * behaves exactly as before (local-only, no accounts).
 */
export function getAuthConfig(env: EnvLike): AuthConfig | null {
  const githubClientId = readEnv(env, 'GITHUB_CLIENT_ID');
  const githubClientSecret = readEnv(env, 'GITHUB_CLIENT_SECRET');
  const sessionSecret = readEnv(env, 'SESSION_SECRET');

  if (!githubClientId || !githubClientSecret || !sessionSecret || sessionSecret.length < 32) {
    return null;
  }

  return { githubClientId, githubClientSecret, sessionSecret };
}

export async function getSessionUser(request: Request, env: EnvLike): Promise<SessionUser | null> {
  const config = getAuthConfig(env);
  const token = readCookie(request, SESSION_COOKIE);

  if (!config || !token) {
    return null;
  }

  return readSessionToken(token, config.sessionSecret);
}

/** Mutating requests must come from this origin (SameSite=Lax cookies are the first line of defence). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');

  if (!origin) {
    // Non-browser clients send no Origin; browsers always send it on POST/PUT/DELETE.
    return request.method === 'GET' || request.method === 'HEAD';
  }

  return origin === new URL(request.url).origin;
}

/** The Worker bindings/vars as a plain record (the generated `Env` type has no index signature). */
export function envOf(context: { cloudflare?: { env?: unknown } } | undefined): EnvLike {
  return context?.cloudflare?.env as EnvLike;
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/apps';
  }

  return value;
}
