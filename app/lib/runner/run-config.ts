/**
 * `.appforge` run configuration, the equivalent of Replit's `.replit`:
 *
 *   # .appforge
 *   install = "npm install"
 *   run = "npm run dev"
 *
 * Only `key = "value"` lines are read (single or double quotes); `#` starts a
 * comment. When `run` is set the Run button uses it instead of auto-detection.
 */
export const RUN_CONFIG_FILE = '.appforge';

export interface RunConfig {
  run?: string;
  install?: string;
}

const LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')\s*(?:#.*)?$/;

export function parseRunConfig(source: string): RunConfig {
  const config: RunConfig = {};

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(LINE);

    if (!match) {
      continue;
    }

    const [, key, doubleQuoted, singleQuoted] = match;
    const value = (doubleQuoted !== undefined ? doubleQuoted.replace(/\\(["\\])/g, '$1') : singleQuoted).trim();

    if ((key === 'run' || key === 'install') && value) {
      config[key] = value;
    }
  }

  return config;
}

/** The command the Run button executes for a config, or null to fall back to detection. */
export function commandFromRunConfig(config: RunConfig): string | null {
  if (!config.run) {
    return null;
  }

  return config.install ? `${config.install} && ${config.run}` : config.run;
}
