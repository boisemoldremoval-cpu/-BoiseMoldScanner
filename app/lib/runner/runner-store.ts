import type { WebContainerProcess } from '@webcontainer/api';
import { atom } from 'nanostores';
import { appendBounded, buildRunCommand, stripAnsi } from './run-command';
import { secretsToEnv } from './secrets';
import { secretsStore } from './secrets-store';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { WORK_DIR } from '~/utils/constants';
import { detectProjectCommands } from '~/utils/projectCommands';
import { coloredText } from '~/utils/terminal';

export type RunStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'failed';

const MAX_BUFFER_CHARS = 200_000;
const ALERT_TAIL_CHARS = 4_000;

/**
 * Drives the workspace "Run" button: detects how to start the project, runs it
 * in the WebContainer with the project's secrets as environment variables, and
 * streams output to the Console view. A non-zero exit raises the same
 * "Ask AI to fix" alert used for terminal errors.
 */
class RunnerStore {
  status = atom<RunStatus>('idle');
  command = atom<string | null>(null);

  #process: WebContainerProcess | undefined;
  #console: ITerminal | undefined;
  #buffer = '';
  #stopRequested = false;

  attachConsole(terminal: ITerminal) {
    this.#console = terminal;
    terminal.reset();

    if (this.#buffer) {
      terminal.write(this.#buffer);
    } else {
      terminal.write(coloredText.cyan('Press Run to install dependencies and start your app.\r\n'));
    }
  }

  detachConsole(terminal: ITerminal) {
    if (this.#console === terminal) {
      this.#console = undefined;
    }
  }

  #write(data: string) {
    this.#buffer = appendBounded(this.#buffer, data, MAX_BUFFER_CHARS);
    this.#console?.write(data);
  }

  async run() {
    if (this.status.get() === 'starting' || this.status.get() === 'running') {
      await this.stop();
    }

    this.#buffer = '';
    this.#console?.reset();
    this.status.set('starting');

    const files = Object.entries(workbenchStore.files.get())
      .filter(([path, dirent]) => {
        // Only root-level files decide how the project starts.
        return dirent?.type === 'file' && !dirent.isBinary && path.slice(WORK_DIR.length + 1).indexOf('/') === -1;
      })
      .map(([path, dirent]) => ({ path, content: dirent?.type === 'file' ? dirent.content : '' }));

    const command = buildRunCommand(await detectProjectCommands(files));
    this.command.set(command);

    if (!command) {
      this.#write(
        coloredText.red('Could not find how to start this project.\r\n') +
          'Add a "dev" or "start" script to package.json, or an index.html, then press Run again.\r\n',
      );
      this.status.set('failed');

      return;
    }

    // The AI's own dev server would hold the port; interrupt it first.
    try {
      workbenchStore.boltTerminal.terminal?.input('\x03');
    } catch {
      // No AI terminal attached yet.
    }

    const env = secretsToEnv(secretsStore.get());
    const secretCount = Object.keys(env).length;

    this.#write(coloredText.cyan(`$ ${command}\r\n`));

    if (secretCount > 0) {
      this.#write(coloredText.cyan(`(${secretCount} secret${secretCount === 1 ? '' : 's'} loaded)\r\n`));
    }

    try {
      const wc = await webcontainer;

      const process = await wc.spawn('jsh', ['-c', command], {
        env,
        terminal: { cols: this.#console?.cols ?? 80, rows: this.#console?.rows ?? 24 },
      });

      this.#process = process;
      this.#stopRequested = false;
      this.status.set('running');

      process.output.pipeTo(new WritableStream({ write: (data) => this.#write(data) })).catch(() => undefined);

      process.exit.then((code) => {
        if (this.#process !== process) {
          return;
        }

        this.#process = undefined;

        if (this.#stopRequested) {
          this.#write(coloredText.cyan('\r\nStopped.\r\n'));
          this.status.set('stopped');

          return;
        }

        this.#write(`\r\nProcess exited with code ${code}\r\n`);
        this.status.set(code === 0 ? 'stopped' : 'failed');

        if (code !== 0) {
          const tail = stripAnsi(this.#buffer).slice(-ALERT_TAIL_CHARS);
          workbenchStore.actionAlert.set({
            type: 'error',
            title: `App exited with code ${code}`,
            description: `\`${command}\` failed`,
            content: tail,
            source: 'terminal',
          });
        }
      });
    } catch (error) {
      this.#write(coloredText.red(`Failed to start: ${error instanceof Error ? error.message : String(error)}\r\n`));
      this.status.set('failed');
    }
  }

  async stop() {
    const process = this.#process;

    if (!process) {
      return;
    }

    this.#stopRequested = true;
    process.kill();
    await process.exit.catch(() => undefined);
  }
}

export const runnerStore = new RunnerStore();
