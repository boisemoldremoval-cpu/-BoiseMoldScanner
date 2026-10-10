import { describe, expect, it } from 'vitest';
import { appendBounded, buildRunCommand, stripAnsi } from './run-command';

describe('buildRunCommand', () => {
  it('chains setup and start commands', () => {
    expect(
      buildRunCommand({
        type: 'Node.js',
        setupCommand: 'npm install',
        startCommand: 'npm run dev',
        followupMessage: '',
      }),
    ).toBe('npm install && npm run dev');
  });

  it('runs the start command alone when there is no setup', () => {
    expect(buildRunCommand({ type: 'Static', startCommand: 'npx --yes serve', followupMessage: '' })).toBe(
      'npx --yes serve',
    );
  });

  it('returns null when the project has no start command', () => {
    expect(buildRunCommand({ type: 'Node.js', setupCommand: 'npm install', followupMessage: '' })).toBeNull();
    expect(buildRunCommand({ type: '', setupCommand: '', followupMessage: '' })).toBeNull();
  });
});

describe('appendBounded', () => {
  it('keeps the most recent characters', () => {
    expect(appendBounded('abc', 'def', 4)).toBe('cdef');
    expect(appendBounded('', 'ab', 4)).toBe('ab');
  });
});

describe('stripAnsi', () => {
  it('removes colour and OSC sequences', () => {
    expect(stripAnsi('\x1b[1;31mError\x1b[0m \x1b]654;interactive\x07done')).toBe('Error done');
  });
});
