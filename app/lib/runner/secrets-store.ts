import { atom } from 'nanostores';
import { parseStoredSecrets, removeSecret, SECRETS_STORAGE_PREFIX, upsertSecret, type Secret } from './secrets';
import { chatId } from '~/lib/persistence/useChatHistory';

/*
 * Secrets live in this browser's localStorage, scoped per project (chat id).
 * Until a new project is saved for the first time it has no id, so secrets
 * added before then are held under UNSAVED and moved over once the id exists.
 */
const UNSAVED = '__unsaved__';

export const secretsStore = atom<Secret[]>([]);

let currentProject = UNSAVED;

function storageKey(project: string) {
  return `${SECRETS_STORAGE_PREFIX}${project}`;
}

function read(project: string): Secret[] {
  try {
    return parseStoredSecrets(globalThis.localStorage?.getItem(storageKey(project)));
  } catch {
    return [];
  }
}

function write(project: string, secrets: Secret[]) {
  try {
    if (secrets.length === 0) {
      globalThis.localStorage?.removeItem(storageKey(project));
    } else {
      globalThis.localStorage?.setItem(storageKey(project), JSON.stringify(secrets));
    }
  } catch {
    // Storage can be unavailable (private mode, quota); keep the in-memory copy.
  }
}

function switchProject(next: string) {
  if (next === currentProject) {
    return;
  }

  if (currentProject === UNSAVED && next !== UNSAVED) {
    const pending = read(UNSAVED);

    if (pending.length > 0 && read(next).length === 0) {
      write(next, pending);
    }

    write(UNSAVED, []);
  }

  currentProject = next;
  secretsStore.set(read(next));
}

if (typeof window !== 'undefined') {
  secretsStore.set(read(UNSAVED));
  chatId.subscribe((id) => switchProject(id ?? UNSAVED));
}

export function saveSecret(secret: Secret, previousKey?: string) {
  const next = upsertSecret(secretsStore.get(), secret, previousKey);
  secretsStore.set(next);
  write(currentProject, next);
}

export function deleteSecret(key: string) {
  const next = removeSecret(secretsStore.get(), key);
  secretsStore.set(next);
  write(currentProject, next);
}
