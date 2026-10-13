/**
 * Minimal key-value storage used for accounts' cloud projects.
 *
 * On Cloudflare this is the `APP_DATA` KV namespace declared in wrangler.jsonc
 * (created automatically on deploy; persisted on disk under .wrangler/ in
 * local dev and `vite preview`/Docker). Without the binding (e.g. tests, the
 * Electron build) it falls back to process memory.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

interface KVNamespaceLike {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

export function kvStore(namespace: KVNamespaceLike): KeyValueStore {
  return {
    get: (key) => namespace.get(key, 'text'),
    put: (key, value) => namespace.put(key, value),
    delete: (key) => namespace.delete(key),
    async list(prefix) {
      const names: string[] = [];

      let cursor: string | undefined;

      do {
        const page = await namespace.list({ prefix, cursor });
        names.push(...page.keys.map((key) => key.name));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);

      return names;
    },
  };
}

export function memoryStore(map = new Map<string, string>()): KeyValueStore {
  return {
    get: async (key) => map.get(key) ?? null,
    put: async (key, value) => void map.set(key, value),
    delete: async (key) => void map.delete(key),
    list: async (prefix) => [...map.keys()].filter((key) => key.startsWith(prefix)).sort(),
  };
}

const fallback = memoryStore();

export function storeFromEnv(env: Record<string, unknown> | undefined): KeyValueStore {
  const binding = env?.APP_DATA as KVNamespaceLike | undefined;
  return binding && typeof binding.get === 'function' ? kvStore(binding) : fallback;
}
