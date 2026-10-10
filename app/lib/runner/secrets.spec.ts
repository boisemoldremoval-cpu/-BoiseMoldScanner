import { describe, expect, it } from 'vitest';
import {
  maskSecret,
  parseStoredSecrets,
  removeSecret,
  secretsToEnv,
  upsertSecret,
  validateSecretKey,
  type Secret,
} from './secrets';

const existing: Secret[] = [{ key: 'API_KEY', value: 'abc' }];

describe('validateSecretKey', () => {
  it.each([
    ['', 'Key is required'],
    ['1ABC', 'Use letters, digits and underscores, not starting with a digit'],
    ['MY-KEY', 'Use letters, digits and underscores, not starting with a digit'],
    ['PATH', 'PATH is reserved'],
    ['node_options', 'node_options is reserved'],
    ['API_KEY', 'API_KEY already exists'],
  ])('rejects %j', (key, message) => {
    expect(validateSecretKey(key, existing)).toBe(message);
  });

  it('accepts a new valid key', () => {
    expect(validateSecretKey('DATABASE_URL', existing)).toBeNull();
    expect(validateSecretKey('_private', existing)).toBeNull();
  });

  it('allows keeping the same key while editing it', () => {
    expect(validateSecretKey('API_KEY', existing, 'API_KEY')).toBeNull();
  });
});

describe('upsertSecret / removeSecret', () => {
  it('appends new secrets', () => {
    expect(upsertSecret(existing, { key: 'B', value: '1' })).toEqual([...existing, { key: 'B', value: '1' }]);
  });

  it('replaces in place, including a rename', () => {
    expect(upsertSecret(existing, { key: 'API_KEY', value: 'new' })).toEqual([{ key: 'API_KEY', value: 'new' }]);
    expect(upsertSecret(existing, { key: 'TOKEN', value: 'abc' }, 'API_KEY')).toEqual([{ key: 'TOKEN', value: 'abc' }]);
  });

  it('removes by key without mutating the input', () => {
    expect(removeSecret(existing, 'API_KEY')).toEqual([]);
    expect(existing).toHaveLength(1);
  });
});

describe('secretsToEnv', () => {
  it('maps valid secrets and drops invalid or reserved keys', () => {
    expect(
      secretsToEnv([
        { key: 'A', value: '1' },
        { key: 'bad-key', value: '2' },
        { key: 'HOME', value: '3' },
      ]),
    ).toEqual({ A: '1' });
  });
});

describe('parseStoredSecrets', () => {
  it.each([null, undefined, '', 'not json', '{"key":"A"}', '42'])('returns [] for %j', (raw) => {
    expect(parseStoredSecrets(raw)).toEqual([]);
  });

  it('keeps only well-formed entries', () => {
    const raw = JSON.stringify([{ key: 'A', value: '1' }, { key: 'B' }, { key: '9x', value: '2' }, null]);
    expect(parseStoredSecrets(raw)).toEqual([{ key: 'A', value: '1' }]);
  });
});

describe('maskSecret', () => {
  it('hides the value and its exact length', () => {
    expect(maskSecret('')).toBe('');
    expect(maskSecret('abc')).toBe('•'.repeat(8));
    expect(maskSecret('x'.repeat(100))).toBe('•'.repeat(24));
  });
});
