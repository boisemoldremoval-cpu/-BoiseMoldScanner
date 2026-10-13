import type { KeyValueStore } from './kv';

/** A project as stored in the cloud: the chat record plus its latest file snapshot. */
export interface CloudProject {
  id: string;
  urlId?: string;
  description?: string;
  timestamp: string;
  metadata?: unknown;
  messages: unknown[];
  snapshot?: unknown;
}

export interface CloudProjectMeta {
  id: string;
  urlId?: string;
  description?: string;
  timestamp: string;
  size: number;
}

export const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Cloudflare KV values may be up to 25 MiB; keep headroom. */
export const MAX_PROJECT_BYTES = 20 * 1024 * 1024;

export class ProjectValidationError extends Error {}

const dataKey = (userId: string, id: string) => `project:${userId}:${id}`;
const metaKey = (userId: string, id: string) => `projectmeta:${userId}:${id}`;

function assertUserId(userId: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) {
    throw new ProjectValidationError('Invalid user');
  }
}

export function validateProject(input: unknown, id: string): CloudProject {
  if (!PROJECT_ID_PATTERN.test(id)) {
    throw new ProjectValidationError('Invalid project id');
  }

  if (!input || typeof input !== 'object') {
    throw new ProjectValidationError('Project body must be an object');
  }

  const body = input as Record<string, unknown>;

  if (!Array.isArray(body.messages)) {
    throw new ProjectValidationError('messages must be an array');
  }

  const timestamp = typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString();

  if (Number.isNaN(Date.parse(timestamp))) {
    throw new ProjectValidationError('Invalid timestamp');
  }

  return {
    id,
    urlId: typeof body.urlId === 'string' ? body.urlId.slice(0, 128) : undefined,
    description: typeof body.description === 'string' ? body.description.slice(0, 200) : undefined,
    timestamp,
    metadata: body.metadata,
    messages: body.messages,
    snapshot: body.snapshot,
  };
}

export async function listProjects(store: KeyValueStore, userId: string): Promise<CloudProjectMeta[]> {
  assertUserId(userId);

  const keys = await store.list(`projectmeta:${userId}:`);
  const metas = await Promise.all(keys.map((key) => store.get(key)));

  return metas
    .filter((raw): raw is string => !!raw)
    .map((raw) => JSON.parse(raw) as CloudProjectMeta)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function getProject(store: KeyValueStore, userId: string, id: string): Promise<CloudProject | null> {
  assertUserId(userId);

  if (!PROJECT_ID_PATTERN.test(id)) {
    return null;
  }

  const raw = await store.get(dataKey(userId, id));

  return raw ? (JSON.parse(raw) as CloudProject) : null;
}

export async function saveProject(
  store: KeyValueStore,
  userId: string,
  project: CloudProject,
): Promise<CloudProjectMeta> {
  assertUserId(userId);

  const serialized = JSON.stringify(project);
  const size = new TextEncoder().encode(serialized).length;

  if (size > MAX_PROJECT_BYTES) {
    throw new ProjectValidationError(`Project is too large to sync (${Math.round(size / 1024 / 1024)} MB)`);
  }

  const meta: CloudProjectMeta = {
    id: project.id,
    urlId: project.urlId,
    description: project.description,
    timestamp: project.timestamp,
    size,
  };

  await store.put(dataKey(userId, project.id), serialized);
  await store.put(metaKey(userId, project.id), JSON.stringify(meta));

  return meta;
}

export async function deleteProject(store: KeyValueStore, userId: string, id: string): Promise<void> {
  assertUserId(userId);

  if (!PROJECT_ID_PATTERN.test(id)) {
    return;
  }

  await store.delete(metaKey(userId, id));
  await store.delete(dataKey(userId, id));
}
