import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  spawn: vi.fn(),
  interrupt: vi.fn(),
  files: undefined as any,
  actionAlert: undefined as any,
}));

vi.mock('~/lib/persistence/useChatHistory', async () => ({ chatId: (await import('nanostores')).atom(undefined) }));
vi.mock('~/lib/webcontainer', () => ({ webcontainer: Promise.resolve({ spawn: h.spawn }) }));
vi.mock('~/lib/stores/workbench', async () => {
  const nano = await import('nanostores');
  h.files = nano.map({});
  h.actionAlert = nano.atom(undefined);

  return {
    workbenchStore: {
      files: h.files,
      actionAlert: h.actionAlert,
      boltTerminal: { terminal: { input: h.interrupt } },
    },
  };
});

const { runnerStore } = await import('./runner-store');
const { secretsStore } = await import('./secrets-store');

function fakeProcess() {
  let resolveExit!: (code: number) => void;
  let push!: (chunk: string) => void;

  const output = new ReadableStream<string>({
    start(controller) {
      push = (chunk) => controller.enqueue(chunk);
    },
  });
  const process = {
    output,
    exit: new Promise<number>((resolve) => (resolveExit = resolve)),
    kill: vi.fn(() => resolveExit(143)),
  };

  return { process, push, exit: (code: number) => resolveExit(code) };
}

function terminal() {
  const written: string[] = [];
  return {
    written,
    term: {
      cols: 100,
      rows: 30,
      reset: vi.fn(),
      write: (d: string) => written.push(d),
      onData: vi.fn(),
      input: vi.fn(),
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('runnerStore', () => {
  beforeEach(() => {
    h.spawn.mockReset();
    h.interrupt.mockReset();
    h.files.set({
      '/home/project/package.json': {
        type: 'file',
        isBinary: false,
        content: JSON.stringify({ scripts: { dev: 'node server.js' } }),
      },
      '/home/project/node_modules/x/package.json': { type: 'file', isBinary: false, content: '{}' },
    });
    h.actionAlert.set(undefined);
    secretsStore.set([{ key: 'GREETING', value: 'hi' }]);
  });

  it('runs install + start with secrets in the environment and streams output to the console', async () => {
    const fake = fakeProcess();
    h.spawn.mockResolvedValue(fake.process);

    const { term, written } = terminal();
    runnerStore.attachConsole(term);

    await runnerStore.run();

    expect(h.interrupt).toHaveBeenCalledWith('\x03');

    const [bin, args, options] = h.spawn.mock.calls[0];
    expect(bin).toBe('jsh');
    expect(args[0]).toBe('-c');
    expect(args[1]).toContain('npm install');
    expect(args[1]).toMatch(/npm run dev$/);
    expect(options.env).toEqual({ GREETING: 'hi' });
    expect(options.terminal).toEqual({ cols: 100, rows: 30 });
    expect(runnerStore.status.get()).toBe('running');
    expect(written.join('')).toContain('1 secret loaded');
    expect(written.join('')).not.toContain('hi\r');

    fake.push('listening on 3000\r\n');
    await flush();
    expect(written.join('')).toContain('listening on 3000');

    fake.exit(0);
    await flush();
    expect(runnerStore.status.get()).toBe('stopped');
    expect(h.actionAlert.get()).toBeUndefined();
  });

  it('raises an "Ask AI to fix" alert when the app crashes', async () => {
    const fake = fakeProcess();
    h.spawn.mockResolvedValue(fake.process);
    await runnerStore.run();

    fake.push('\x1b[31mError: Cannot find module express\x1b[0m\r\n');
    await flush();
    fake.exit(1);
    await flush();

    expect(runnerStore.status.get()).toBe('failed');
    expect(h.actionAlert.get()).toMatchObject({ type: 'error', title: 'App exited with code 1', source: 'terminal' });
    expect(h.actionAlert.get().content).toContain('Error: Cannot find module express');
    expect(h.actionAlert.get().content).not.toContain('\x1b');
  });

  it('stops the running app without raising an alert', async () => {
    const fake = fakeProcess();
    h.spawn.mockResolvedValue(fake.process);
    await runnerStore.run();

    await runnerStore.stop();
    await flush();

    expect(fake.process.kill).toHaveBeenCalled();
    expect(runnerStore.status.get()).toBe('stopped');
    expect(h.actionAlert.get()).toBeUndefined();
  });

  it('explains what is missing when the project has no start command', async () => {
    h.files.set({ '/home/project/README.md': { type: 'file', isBinary: false, content: '# hi' } });

    const { term, written } = terminal();
    runnerStore.attachConsole(term);

    await runnerStore.run();

    expect(h.spawn).not.toHaveBeenCalled();
    expect(runnerStore.status.get()).toBe('failed');
    expect(written.join('')).toContain('Could not find how to start this project');
  });

  it('prefers the .appforge run config over auto-detection', async () => {
    const fake = fakeProcess();
    h.spawn.mockResolvedValue(fake.process);
    h.files.setKey('/home/project/.appforge', {
      type: 'file',
      isBinary: false,
      content: 'install = "npm ci"\nrun = "node api.js"\n',
    });

    await runnerStore.run();

    expect(h.spawn.mock.calls[0][1]).toEqual(['-c', 'npm ci && node api.js']);
    expect(runnerStore.command.get()).toBe('npm ci && node api.js');
  });
});
