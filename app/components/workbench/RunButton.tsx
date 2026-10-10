import { useStore } from '@nanostores/react';
import { memo } from 'react';
import { runnerStore } from '~/lib/runner/runner-store';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';

/** Workspace Run/Stop control: installs dependencies, starts the app and opens the Console. */
export const RunButton = memo(({ disabled }: { disabled?: boolean }) => {
  const status = useStore(runnerStore.status);
  const active = status === 'starting' || status === 'running';

  return (
    <button
      type="button"
      disabled={disabled}
      title={active ? 'Stop the running app' : 'Install dependencies and start the app'}
      onClick={() => {
        if (active) {
          runnerStore.stop();
        } else {
          workbenchStore.selectWorkbenchView('console', { userInitiated: true });
          runnerStore.run();
        }
      }}
      className={classNames(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700',
      )}
    >
      <span className={active ? 'i-ph:stop-fill' : 'i-ph:play-fill'} />
      {active ? 'Stop' : 'Run'}
    </button>
  );
});
