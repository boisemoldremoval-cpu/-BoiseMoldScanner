/**
 * Pure helpers for project secrets (environment variables).
 *
 * Secrets are injected into the running app's process environment by the
 * runner. They are never written into the project's files, so they cannot leak
 * through a GitHub push, a deploy, a download or a chat export.
 */

export interface Secret {
  key: string;
  value: string;
}

export const SECRET_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Variables the runner itself sets; user secrets may not override them. */
export const RESERVED_SECRET_KEYS = new Set(['PATH', 'HOME', 'PWD', 'SHELL', 'CI', 'NODE_OPTIONS']);

export const SECRETS_STORAGE_PREFIX = 'appforge_secrets:';

/** Returns an error message, or null when `key` can be added. */
export function validateSecretKey(key: string, existing: Secret[], editingKey?: string): string | null {
  if (!key) {
    return 'Key is required';
  }

  if (!SECRET_KEY_PATTERN.test(key)) {
    return 'Use letters, digits and underscores, not starting with a digit';
  }

  if (RESERVED_SECRET_KEYS.has(key.toUpperCase())) {
    return `${key} is reserved`;
  }

  if (key !== editingKey && existing.some((secret) => secret.key === key)) {
    return `${key} already exists`;
  }

  return null;
}

export function upsertSecret(secrets: Secret[], secret: Secret, previousKey?: string): Secret[] {
  const replaceKey = previousKey ?? secret.key;
  const index = secrets.findIndex((s) => s.key === replaceKey);

  if (index === -1) {
    return [...secrets, secret];
  }

  const next = [...secrets];
  next[index] = secret;

  return next;
}

export function removeSecret(secrets: Secret[], key: string): Secret[] {
  return secrets.filter((secret) => secret.key !== key);
}

export function secretsToEnv(secrets: Secret[]): Record<string, string> {
  return Object.fromEntries(
    secrets
      .filter((secret) => SECRET_KEY_PATTERN.test(secret.key) && !RESERVED_SECRET_KEYS.has(secret.key.toUpperCase()))
      .map((secret) => [secret.key, secret.value]),
  );
}

/** Parses stored JSON defensively; anything malformed yields an empty list. */
export function parseStoredSecrets(raw: string | null | undefined): Secret[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is Secret =>
        item && typeof item.key === 'string' && typeof item.value === 'string' && SECRET_KEY_PATTERN.test(item.key),
    );
  } catch {
    return [];
  }
}

export function maskSecret(value: string): string {
  return value ? '•'.repeat(Math.min(Math.max(value.length, 8), 24)) : '';
}
