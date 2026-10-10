import { useStore } from '@nanostores/react';
import { memo, useEffect, useRef } from 'react';
import { Terminal, type TerminalRef } from './terminal/Terminal';
import { runnerStore, type RunStatus } from '~/lib/runner/runner-store';
import { themeStore } from '~/lib/stores/theme';
import { classNames } from '~/utils/classNames';

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: 'Not running',
  starting: 'Starting…',
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
};

/** Read-only output of the app started with the Run button. */
export const ConsolePanel = memo(() => {
  const theme = useStore(themeStore);
  const status = useStore(runnerStore.status);
  const command = useStore(runnerStore.command);
  const terminalRef = useRef<TerminalRef>(null);

  useEffect(() => {
    return () => {
      const terminal = terminalRef.current?.getTerminal();

      if (terminal) {
        runnerStore.detachConsole(terminal);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-bolt-elements-terminals-background">
      <div className="flex items-center gap-2 px-3 py-2 text-xs border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
        <span
          className={classNames('w-2 h-2 rounded-full', {
            'bg-green-500': status === 'running',
            'bg-yellow-500 animate-pulse': status === 'starting',
            'bg-red-500': status === 'failed',
            'bg-bolt-elements-textTertiary': status === 'idle' || status === 'stopped',
          })}
        />
        <span className="text-bolt-elements-textPrimary font-medium">{STATUS_LABEL[status]}</span>
        {command && <code className="truncate text-bolt-elements-textTertiary">{command}</code>}
      </div>
      <Terminal
        id="run-console"
        ref={terminalRef}
        readonly
        theme={theme}
        className="flex-1 overflow-hidden modern-scrollbar-invert"
        onTerminalReady={(terminal) => runnerStore.attachConsole(terminal)}
      />
    </div>
  );
});
