import type { ProjectCommands } from '~/utils/projectCommands';

/** Chains the detected setup and start commands into one shell command. */
export function buildRunCommand(commands: ProjectCommands): string | null {
  const parts = [commands.setupCommand, commands.startCommand].filter((part): part is string => !!part?.trim());

  if (!commands.startCommand?.trim()) {
    return null;
  }

  return parts.join(' && ');
}

/** Keeps the last `maxChars` characters of console output. */
export function appendBounded(buffer: string, chunk: string, maxChars: number): string {
  const next = buffer + chunk;
  return next.length > maxChars ? next.slice(next.length - maxChars) : next;
}

/** Strips ANSI escape sequences so output can be shown to the AI. */
export function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g, '');
}
