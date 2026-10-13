import { toast } from 'react-toastify';
import { projectSaved } from './save-events';
import {
  chatId,
  chatMetadata,
  db,
  getAll,
  getMessagesByIdRaw,
  getNextId,
  getSnapshot,
  getUrlId,
  setMessages,
  setSnapshot,
  updateChatMetadata,
  type ChatHistoryItem,
} from '~/lib/persistence';
import type { Snapshot } from '~/lib/persistence/types';
import { authStore, loadAuth } from '~/lib/stores/auth';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CloudSync');

export interface CloudProjectMeta {
  id: string;
  urlId?: string;
  description?: string;
  timestamp: string;
  size: number;
}

interface CloudProject {
  id: string;
  urlId?: string;
  description?: string;
  timestamp: string;
  metadata?: ChatHistoryItem['metadata'];
  messages: ChatHistoryItem['messages'];
  snapshot?: Snapshot;
}

const SYNC_DELAY_MS = 2000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function signedIn() {
  return !!authStore.get().user;
}

function newCloudId() {
  return crypto.randomUUID();
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...init });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  return body;
}

/** Gives a local project a stable cloud id (stored in its metadata) the first time it syncs. */
async function ensureCloudId(localId: string, chat: ChatHistoryItem): Promise<string> {
  const existing = chat.metadata?.cloudId;

  if (existing) {
    return existing;
  }

  const cloudId = newCloudId();
  const metadata = { ...chat.metadata, cloudId };
  await updateChatMetadata(db!, localId, metadata);

  // The open chat re-saves its in-memory metadata; keep it in step or the id would be lost.
  if (chatId.get() === localId) {
    chatMetadata.set({ ...chatMetadata.get(), cloudId });
  }

  return cloudId;
}

/** Uploads one local project (messages + latest file snapshot). */
export async function pushProject(localId: string): Promise<void> {
  if (!db || !signedIn()) {
    return;
  }

  const chat = await getMessagesByIdRaw(db, localId);

  if (!chat?.messages?.length) {
    return;
  }

  const cloudId = await ensureCloudId(localId, chat);
  const snapshot = await getSnapshot(db, localId);

  const project: CloudProject = {
    id: cloudId,
    urlId: chat.urlId,
    description: chat.description,
    timestamp: chat.timestamp,
    metadata: { ...chat.metadata, cloudId },
    messages: chat.messages,
    snapshot,
  };

  await api(`/api/cloud-project/${encodeURIComponent(cloudId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
}

export function scheduleCloudSync(localId: string) {
  if (!signedIn()) {
    return;
  }

  clearTimeout(timers.get(localId));
  timers.set(
    localId,
    setTimeout(() => {
      timers.delete(localId);
      pushProject(localId).catch((error) => {
        logger.error('Cloud sync failed', error);
        toast.error(`Cloud save failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      });
    }, SYNC_DELAY_MS),
  );
}

/** Uploads every project in this browser; returns how many were synced. */
export async function syncAllProjects(): Promise<number> {
  if (!db || !signedIn()) {
    return 0;
  }

  const chats = (await getAll(db)).filter((chat) => chat.messages?.length);

  for (const chat of chats) {
    await pushProject(chat.id);
  }

  return chats.length;
}

export async function listCloudProjects(): Promise<CloudProjectMeta[]> {
  if (!signedIn()) {
    return [];
  }

  return (await api<{ projects: CloudProjectMeta[] }>('/api/cloud-projects')).projects;
}

export async function deleteCloudProject(cloudId: string): Promise<void> {
  await api(`/api/cloud-project/${encodeURIComponent(cloudId)}`, { method: 'DELETE' });
}

/**
 * Makes a cloud project available locally (newer copy wins) and returns the
 * url id to open it at.
 */
export async function pullCloudProject(cloudId: string): Promise<string> {
  if (!db) {
    throw new Error('Local storage is unavailable in this browser');
  }

  const { project } = await api<{ project: CloudProject }>(`/api/cloud-project/${encodeURIComponent(cloudId)}`);
  const local = (await getAll(db)).find((chat) => chat.metadata?.cloudId === cloudId);

  if (local && Date.parse(local.timestamp) >= Date.parse(project.timestamp)) {
    return local.urlId ?? local.id;
  }

  const localId = local?.id ?? (await getNextId(db));
  const urlId = local?.urlId ?? (await getUrlId(db, project.urlId || localId));

  await setMessages(db, localId, project.messages, urlId, project.description, project.timestamp, {
    ...project.metadata,
    cloudId,
  });

  if (project.snapshot) {
    await setSnapshot(db, localId, project.snapshot);
  }

  return urlId;
}

if (typeof window !== 'undefined') {
  void loadAuth();
  projectSaved.subscribe((event) => {
    if (event) {
      scheduleCloudSync(event.id);
    }
  });
}
