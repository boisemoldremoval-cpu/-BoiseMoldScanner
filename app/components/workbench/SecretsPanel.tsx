import { useStore } from '@nanostores/react';
import { memo, useState } from 'react';
import { maskSecret, validateSecretKey, type Secret } from '~/lib/runner/secrets';
import { deleteSecret, saveSecret, secretsStore } from '~/lib/runner/secrets-store';
import { classNames } from '~/utils/classNames';

const inputClass =
  'w-full px-2.5 py-1.5 text-sm rounded-md bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-accent-500';

/**
 * Per-project secrets, exposed to the running app as environment variables.
 * They are stored in this browser only and never written into project files.
 */
export const SecretsPanel = memo(() => {
  const secrets = useStore(secretsStore);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const reset = () => {
    setKey('');
    setValue('');
    setEditing(undefined);
    setError(null);
  };

  const submit = () => {
    const trimmedKey = key.trim();
    const problem = validateSecretKey(trimmedKey, secrets, editing);

    if (problem) {
      setError(problem);
      return;
    }

    saveSecret({ key: trimmedKey, value }, editing);
    reset();
  };

  const edit = (secret: Secret) => {
    setKey(secret.key);
    setValue(secret.value);
    setEditing(secret.key);
    setError(null);
  };

  const toggleReveal = (secretKey: string) => {
    setRevealed((current) => {
      const next = new Set(current);

      if (next.has(secretKey)) {
        next.delete(secretKey);
      } else {
        next.add(secretKey);
      }

      return next;
    });
  };

  return (
    <div className="h-full overflow-y-auto modern-scrollbar p-4 bg-bolt-elements-background-depth-2">
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h2 className="text-base font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
            <span className="i-ph:lock-key-duotone text-lg" />
            Secrets
          </h2>
          <p className="mt-1 text-sm text-bolt-elements-textSecondary">
            Environment variables for API keys and passwords. They are passed to your app when you press Run (read them
            with <code>process.env.NAME</code>, or <code>import.meta.env.VITE_NAME</code> in Vite front ends), stored
            only in this browser, and never written into your files, GitHub pushes or deploys. Values prefixed with{' '}
            <code>VITE_</code> or <code>NEXT_PUBLIC_</code> end up in the browser bundle, so only use those for public
            keys.
          </p>
        </div>

        <form
          className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2 items-start"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            className={inputClass}
            placeholder="KEY_NAME"
            value={key}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setKey(event.target.value);
              setError(null);
            }}
            aria-label="Secret key"
          />
          <input
            className={inputClass}
            placeholder="value"
            type="password"
            value={value}
            autoComplete="new-password"
            onChange={(event) => setValue(event.target.value)}
            aria-label="Secret value"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm rounded-md bg-accent-500 text-white hover:bg-accent-600 whitespace-nowrap"
            >
              {editing ? 'Update' : 'Add secret'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={reset}
                className="px-3 py-1.5 text-sm rounded-md border border-bolt-elements-borderColor text-bolt-elements-textSecondary"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        {error && <p className="text-sm text-red-500">{error}</p>}

        {secrets.length === 0 ? (
          <p className="text-sm text-bolt-elements-textTertiary">No secrets yet.</p>
        ) : (
          <ul className="divide-y divide-bolt-elements-borderColor border border-bolt-elements-borderColor rounded-md">
            {secrets.map((secret) => (
              <li key={secret.key} className="flex items-center gap-3 px-3 py-2">
                <code className="text-sm font-semibold text-bolt-elements-textPrimary">{secret.key}</code>
                <code
                  className={classNames(
                    'flex-1 truncate text-sm',
                    revealed.has(secret.key) ? 'text-bolt-elements-textSecondary' : 'text-bolt-elements-textTertiary',
                  )}
                >
                  {revealed.has(secret.key) ? secret.value : maskSecret(secret.value)}
                </code>
                <button
                  type="button"
                  title={revealed.has(secret.key) ? 'Hide value' : 'Show value'}
                  onClick={() => toggleReveal(secret.key)}
                  className={classNames(
                    revealed.has(secret.key) ? 'i-ph:eye-slash' : 'i-ph:eye',
                    'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                  )}
                />
                <button
                  type="button"
                  title="Edit"
                  onClick={() => edit(secret)}
                  className="i-ph:pencil-simple text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                />
                <button
                  type="button"
                  title="Delete"
                  onClick={() => deleteSecret(secret.key)}
                  className="i-ph:trash text-bolt-elements-textSecondary hover:text-red-500"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});
