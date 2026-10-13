import { describe, expect, it } from 'vitest';
import { getAuthConfig, getSessionUser, isSameOrigin, sanitizeReturnTo } from './config';
import {
  createSessionToken,
  readCookie,
  readSessionToken,
  serializeCookie,
  signValue,
  unsignValue,
  SESSION_COOKIE,
} from './session';

const SECRET = 'x'.repeat(40);
const user = { id: 'gh-1', login: 'octo', avatarUrl: 'https://example.com/a.png' };

describe('signed values', () => {
  it('round-trips and rejects tampering or the wrong secret', async () => {
    const signed = await signValue('hello', SECRET);
    expect(await unsignValue(signed, SECRET)).toBe('hello');
    expect(await unsignValue(signed.replace('hello', 'hellp'), SECRET)).toBeNull();
    expect(await unsignValue(signed, 'y'.repeat(40))).toBeNull();
    expect(await unsignValue('no-dot', SECRET)).toBeNull();
    expect(await unsignValue('abc.!!!', SECRET)).toBeNull();
  });
});

describe('session tokens', () => {
  it('returns the user while valid and null once expired', async () => {
    const now = Date.UTC(2026, 9, 13);
    const token = await createSessionToken(user, SECRET, now, 60);

    expect(await readSessionToken(token, SECRET, now + 59_000)).toEqual(user);
    expect(await readSessionToken(token, SECRET, now + 61_000)).toBeNull();
  });

  it('rejects a payload swapped from another token', async () => {
    const a = await createSessionToken(user, SECRET);
    const b = await createSessionToken({ ...user, id: 'gh-2' }, SECRET);
    const forged = `${b.split('.')[0]}.${a.split('.')[1]}`;

    expect(await readSessionToken(forged, SECRET)).toBeNull();
  });
});

describe('cookies', () => {
  it('serializes HttpOnly, SameSite=Lax cookies and reads them back', () => {
    const header = serializeCookie('a', 'b c', { maxAge: 10, secure: true });
    expect(header).toBe('a=b%20c; Path=/; Max-Age=10; HttpOnly; SameSite=Lax; Secure');

    const request = new Request('https://x.test', { headers: { Cookie: 'other=1; a=b%20c' } });
    expect(readCookie(request, 'a')).toBe('b c');
    expect(readCookie(request, 'missing')).toBeNull();
  });
});

describe('auth config', () => {
  const env = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret', SESSION_SECRET: SECRET };

  it('is enabled only with all variables and a long enough session secret', () => {
    expect(getAuthConfig(env)).toEqual({ githubClientId: 'id', githubClientSecret: 'secret', sessionSecret: SECRET });
    expect(getAuthConfig({ ...env, SESSION_SECRET: 'short' })).toBeNull();
    expect(getAuthConfig({ GITHUB_CLIENT_ID: 'id' })).toBeNull();
  });

  it('reads the user from the session cookie', async () => {
    const token = await createSessionToken(user, SECRET);
    const request = new Request('https://x.test', { headers: { Cookie: `${SESSION_COOKIE}=${token}` } });

    expect(await getSessionUser(request, env)).toEqual(user);
    expect(await getSessionUser(request, {})).toBeNull();
    expect(await getSessionUser(new Request('https://x.test'), env)).toBeNull();
  });
});

describe('isSameOrigin', () => {
  it('allows same-origin and Origin-less GETs, blocks cross-site and Origin-less writes', () => {
    const req = (method: string, origin?: string) =>
      new Request('https://app.test/api/x', { method, headers: origin ? { Origin: origin } : {} });

    expect(isSameOrigin(req('PUT', 'https://app.test'))).toBe(true);
    expect(isSameOrigin(req('PUT', 'https://evil.test'))).toBe(false);
    expect(isSameOrigin(req('DELETE'))).toBe(false);
    expect(isSameOrigin(req('GET'))).toBe(true);
  });
});

describe('sanitizeReturnTo', () => {
  it.each([
    ['/chat/1', '/chat/1'],
    [null, '/apps'],
    ['https://evil.test', '/apps'],
    ['//evil.test', '/apps'],
    ['/\\evil.test', '/apps'],
  ])('%s -> %s', (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });
});
