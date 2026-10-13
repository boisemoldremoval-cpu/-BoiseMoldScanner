import { describe, expect, it } from 'vitest';
import { action, loader } from '~/routes/api.cloud-project.$id';
import { loader as listLoader } from '~/routes/api.cloud-projects';
import { loader as meLoader } from '~/routes/api.me';
import { createSessionToken, SESSION_COOKIE } from '~/lib/.server/auth/session';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://app.test';

function context() {
  const map = new Map<string, string>();

  const namespace = {
    get: async (key: string) => map.get(key) ?? null,
    put: async (key: string, value: string) => void map.set(key, value),
    delete: async (key: string) => void map.delete(key),
    list: async ({ prefix }: { prefix: string }) => ({
      keys: [...map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  };

  return {
    cloudflare: {
      env: { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret', SESSION_SECRET: SECRET, APP_DATA: namespace },
    },
  } as any;
}

async function cookieFor(id: string) {
  return `${SESSION_COOKIE}=${await createSessionToken({ id, login: id }, SECRET)}`;
}

function request(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);

  if (init.cookie) {
    headers.set('Cookie', init.cookie);
  }

  return new Request(`${ORIGIN}${path}`, { ...init, headers });
}

const put = (cookie: string, id: string, payload: unknown, origin = ORIGIN) =>
  request(`/api/cloud-project/${id}`, {
    method: 'PUT',
    cookie,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

describe('cloud project API', () => {
  it('saves, lists and reads a project for the signed-in user only', async () => {
    const ctx = context();
    const alice = await cookieFor('gh-1');
    const bob = await cookieFor('gh-2');
    const payload = { messages: [{ id: 'm' }], description: 'Todo', timestamp: '2026-10-13T00:00:00Z' };

    const saved = await action({ request: put(alice, 'p1', payload), context: ctx, params: { id: 'p1' } } as any);
    expect(saved.status).toBe(200);

    const list = await listLoader({ request: request('/api/cloud-projects', { cookie: alice }), context: ctx } as any);
    expect(((await list.json()) as any).projects.map((p: { id: string }) => p.id)).toEqual(['p1']);

    const read = await loader({
      request: request('/api/cloud-project/p1', { cookie: alice }),
      context: ctx,
      params: { id: 'p1' },
    } as any);
    expect(((await read.json()) as any).project.description).toBe('Todo');

    const other = await loader({
      request: request('/api/cloud-project/p1', { cookie: bob }),
      context: ctx,
      params: { id: 'p1' },
    } as any);
    expect(other.status).toBe(404);
  });

  it('requires sign-in, same origin and valid bodies', async () => {
    const ctx = context();
    const alice = await cookieFor('gh-1');

    const anonymous = await listLoader({ request: request('/api/cloud-projects'), context: ctx } as any);
    expect(anonymous.status).toBe(401);

    const crossSite = await action({
      request: put(alice, 'p1', { messages: [] }, 'https://evil.test'),
      context: ctx,
      params: { id: 'p1' },
    } as any);
    expect(crossSite.status).toBe(403);

    const invalid = await action({
      request: put(alice, 'p1', { nope: true }),
      context: ctx,
      params: { id: 'p1' },
    } as any);
    expect(invalid.status).toBe(400);

    const badId = await action({
      request: put(alice, '..', { messages: [] }),
      context: ctx,
      params: { id: '..' },
    } as any);
    expect(badId.status).toBe(400);
  });

  it('deletes a project', async () => {
    const ctx = context();
    const alice = await cookieFor('gh-1');
    await action({ request: put(alice, 'p1', { messages: [] }), context: ctx, params: { id: 'p1' } } as any);

    const deleted = await action({
      request: request('/api/cloud-project/p1', { method: 'DELETE', cookie: alice, headers: { Origin: ORIGIN } }),
      context: ctx,
      params: { id: 'p1' },
    } as any);
    expect(deleted.status).toBe(200);

    const read = await loader({
      request: request('/api/cloud-project/p1', { cookie: alice }),
      context: ctx,
      params: { id: 'p1' },
    } as any);
    expect(read.status).toBe(404);
  });

  it('reports the session and whether sign-in is enabled', async () => {
    const ctx = context();

    const me = await meLoader({
      request: request('/api/me', { cookie: await cookieFor('gh-1') }),
      context: ctx,
    } as any);
    expect((await me.json()) as any).toEqual({ user: { id: 'gh-1', login: 'gh-1' }, authEnabled: true });

    const disabled = await meLoader({ request: request('/api/me'), context: { cloudflare: { env: {} } } } as any);
    expect((await disabled.json()) as any).toEqual({ user: null, authEnabled: false });
  });
});
