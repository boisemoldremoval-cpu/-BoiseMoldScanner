import { describe, expect, it } from 'vitest';
import { commandFromRunConfig, parseRunConfig } from './run-config';

describe('parseRunConfig', () => {
  it('reads run and install, ignoring comments, blanks and unknown keys', () => {
    const source = [
      '# start the API',
      'install = "npm ci"',
      '',
      "run = 'node server.js --port 3000'  # trailing comment",
      'entrypoint = "index.js"',
    ].join('\n');

    expect(parseRunConfig(source)).toEqual({ install: 'npm ci', run: 'node server.js --port 3000' });
  });

  it('handles escaped quotes and CRLF line endings', () => {
    expect(parseRunConfig('run = "echo \\"hi\\""\r\n')).toEqual({ run: 'echo "hi"' });
  });

  it('ignores malformed and empty values', () => {
    expect(parseRunConfig('run = npm start\nrun = ""\ninstall')).toEqual({});
  });
});

describe('commandFromRunConfig', () => {
  it('chains install before run', () => {
    expect(commandFromRunConfig({ install: 'npm ci', run: 'npm start' })).toBe('npm ci && npm start');
    expect(commandFromRunConfig({ run: 'npm start' })).toBe('npm start');
  });

  it('falls back to detection without a run command', () => {
    expect(commandFromRunConfig({ install: 'npm ci' })).toBeNull();
    expect(commandFromRunConfig({})).toBeNull();
  });
});
