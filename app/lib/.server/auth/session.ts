/**
 * Stateless sessions: a signed cookie (HMAC-SHA256 over a base64url JSON
 * payload). Nothing is stored server-side, so this works the same on
 * Cloudflare Workers and in Node/Docker. Uses Web Crypto only.
 */

export interface SessionUser {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

export const SESSION_COOKIE = 'af_session';
export const OAUTH_STATE_COOKIE = 'af_oauth_state';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);

  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

export async function signValue(value: string, secret: string): Promise<string> {
  return `${value}.${toBase64Url(await hmac(secret, value))}`;
}

/** Returns the original value if the signature is valid, otherwise null. */
export async function unsignValue(signed: string, secret: string): Promise<string | null> {
  const dot = signed.lastIndexOf('.');

  if (dot <= 0) {
    return null;
  }

  const value = signed.slice(0, dot);

  try {
    const expected = await hmac(secret, value);
    return timingSafeEqual(expected, fromBase64Url(signed.slice(dot + 1))) ? value : null;
  } catch {
    return null;
  }
}

export async function createSessionToken(
  user: SessionUser,
  secret: string,
  now = Date.now(),
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const payload: SessionPayload = { ...user, exp: Math.floor(now / 1000) + ttlSeconds };
  return signValue(toBase64Url(encoder.encode(JSON.stringify(payload))), secret);
}

export async function readSessionToken(token: string, secret: string, now = Date.now()): Promise<SessionUser | null> {
  const value = await unsignValue(token, secret);

  if (!value) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as SessionPayload;

    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now || typeof payload.id !== 'string') {
      return null;
    }

    const { exp: _exp, ...user } = payload;

    return user;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 24): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/* -------------------------------------------------------------------------- */
/* Cookies                                                                     */
/* -------------------------------------------------------------------------- */

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');

  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');

    if (rawName === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean; path?: string },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
    `Max-Age=${options.maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:';
}
