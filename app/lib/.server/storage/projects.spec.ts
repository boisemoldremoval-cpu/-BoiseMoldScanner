import { describe, expect, it } from 'vitest';
import { kvStore, memoryStore } from './kv';
import {
  deleteProject,
  getProject,
  listProjects,
  MAX_PROJECT_BYTES,
  ProjectValidationError,
  saveProject,
  validateProject,
} from './projects';

const body = (overrides: Record<string, unknown> = {}) => ({
  messages: [{ id: 'm', role: 'user', parts: [] }],
  description: 'My app',
  timestamp: '2026-10-13T10:00:00.000Z',
  ...overrides,
});

describe('validateProject', () => {
  it('normalises a valid body', () => {
    expect(validateProject(body({ urlId: 'my-app', extra: 1 }), 'abc-123')).toEqual({
      id: 'abc-123',
      urlId: 'my-app',
      description: 'My app',
      timestamp: '2026-10-13T10:00:00.000Z',
      metadata: undefined,
      messages: body().messages,
      snapshot: undefined,
    });
  });

  it.each([
    ['bad id', body(), '../etc'],
    ['non-object', null, 'a'],
    ['missing messages', { description: 'x' }, 'a'],
    ['bad timestamp', body({ timestamp: 'later' }), 'a'],
  ])('rejects %s', (_label, input, id) => {
    expect(() => validateProject(input, id as string)).toThrow(ProjectValidationError);
  });
});

describe('project repository', () => {
  it('saves, lists newest first, reads and deletes per user', async () => {
    const store = memoryStore();

    await saveProject(store, 'gh-1', validateProject(body({ timestamp: '2026-10-01T00:00:00Z' }), 'old'));
    await saveProject(store, 'gh-1', validateProject(body({ description: 'New' }), 'new'));
    await saveProject(store, 'gh-2', validateProject(body(), 'other'));

    expect((await listProjects(store, 'gh-1')).map((p) => p.id)).toEqual(['new', 'old']);
    expect((await getProject(store, 'gh-1', 'new'))?.description).toBe('New');
    expect(await getProject(store, 'gh-2', 'new')).toBeNull();

    await deleteProject(store, 'gh-1', 'new');
    expect((await listProjects(store, 'gh-1')).map((p) => p.id)).toEqual(['old']);
    expect(await getProject(store, 'gh-1', 'new')).toBeNull();
  });

  it('refuses projects over the size limit', async () => {
    const huge = validateProject(body({ snapshot: 'x'.repeat(MAX_PROJECT_BYTES) }), 'big');
    await expect(saveProject(memoryStore(), 'gh-1', huge)).rejects.toThrow(/too large/);
  });

  it('rejects malformed user ids so keys cannot cross users', async () => {
    await expect(listProjects(memoryStore(), 'gh-1:project')).rejects.toThrow(ProjectValidationError);
  });
});

describe('kvStore', () => {
  it('pages through Cloudflare KV list results', async () => {
    const pages = [
      { keys: [{ name: 'p:1' }], list_complete: false, cursor: 'c1' },
      { keys: [{ name: 'p:2' }], list_complete: true },
    ];

    const cursors: Array<string | undefined> = [];

    const store = kvStore({
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async ({ cursor }) => {
        cursors.push(cursor);
        return pages[cursors.length - 1];
      },
    });

    expect(await store.list('p:')).toEqual(['p:1', 'p:2']);
    expect(cursors).toEqual([undefined, 'c1']);
  });
});
