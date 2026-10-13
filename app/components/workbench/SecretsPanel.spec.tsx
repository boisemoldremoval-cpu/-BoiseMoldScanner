import { fireEvent, render, screen, within } from '@testing-library/react';
import { atom } from 'nanostores';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatId = vi.hoisted(() => ({ store: undefined as unknown as ReturnType<typeof atom<string | undefined>> }));

vi.mock('~/lib/persistence/useChatHistory', async () => {
  const { atom: makeAtom } = await import('nanostores');
  chatId.store = makeAtom<string | undefined>(undefined);

  return { chatId: chatId.store };
});

const { SecretsPanel } = await import('./SecretsPanel');
const { secretsStore } = await import('~/lib/runner/secrets-store');

function addSecret(key: string, value: string) {
  fireEvent.change(screen.getByLabelText('Secret key'), { target: { value: key } });
  fireEvent.change(screen.getByLabelText('Secret value'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Add secret' }));
}

describe('SecretsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    chatId.store.set(undefined);
    secretsStore.set([]);
  });

  it('adds a secret, masks its value and stores it locally', () => {
    render(<SecretsPanel />);
    addSecret('API_TOKEN', 'super-secret');

    const row = screen.getByText('API_TOKEN').closest('li')!;
    expect(within(row).queryByText('super-secret')).toBeNull();

    fireEvent.click(within(row).getByTitle('Show value'));
    expect(within(row).getByText('super-secret')).toBeTruthy();

    expect(JSON.parse(localStorage.getItem('appfreedom_secrets:__unsaved__')!)).toEqual([
      { key: 'API_TOKEN', value: 'super-secret' },
    ]);
  });

  it('rejects invalid and duplicate keys', () => {
    render(<SecretsPanel />);
    addSecret('bad-key', 'x');
    expect(screen.getByText('Use letters, digits and underscores, not starting with a digit')).toBeTruthy();

    addSecret('GOOD', '1');
    addSecret('GOOD', '2');
    expect(screen.getByText('GOOD already exists')).toBeTruthy();
    expect(secretsStore.get()).toEqual([{ key: 'GOOD', value: '1' }]);
  });

  it('edits and deletes secrets', () => {
    render(<SecretsPanel />);
    addSecret('A', '1');

    fireEvent.click(screen.getByTitle('Edit'));
    fireEvent.change(screen.getByLabelText('Secret value'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(secretsStore.get()).toEqual([{ key: 'A', value: '2' }]);

    fireEvent.click(screen.getByTitle('Delete'));
    expect(secretsStore.get()).toEqual([]);
    expect(screen.getByText('No secrets yet.')).toBeTruthy();
  });

  it('moves secrets added before the first save onto the project, and scopes them per project', () => {
    render(<SecretsPanel />);
    addSecret('A', '1');

    chatId.store.set('project-1');
    expect(localStorage.getItem('appfreedom_secrets:__unsaved__')).toBeNull();
    expect(JSON.parse(localStorage.getItem('appfreedom_secrets:project-1')!)).toEqual([{ key: 'A', value: '1' }]);

    chatId.store.set('project-2');
    expect(secretsStore.get()).toEqual([]);

    chatId.store.set('project-1');
    expect(secretsStore.get()).toEqual([{ key: 'A', value: '1' }]);
  });
});
