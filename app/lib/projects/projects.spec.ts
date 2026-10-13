import { describe, expect, it } from 'vitest';
import {
  detectStack,
  filterProjects,
  formatRelative,
  mergeCloudProjects,
  sortByRecent,
  toProjectSummary,
} from './projects';
import type { ChatHistoryItem } from '~/lib/persistence/useChatHistory';

function chat(overrides: Partial<ChatHistoryItem>): ChatHistoryItem {
  return { id: '1', messages: [], timestamp: '2026-10-01T10:00:00.000Z', ...overrides } as ChatHistoryItem;
}

const assistant = (text: string) => ({ id: 'a', role: 'assistant', parts: [{ type: 'text', text }] }) as any;

describe('toProjectSummary', () => {
  it('uses the description, urlId link and detected stack', () => {
    const summary = toProjectSummary(
      chat({
        urlId: 'my-app',
        description: ' Todo app ',
        messages: [assistant('<boltAction type="file" filePath="package.json">{"dependencies":{"react":"19"}}')],
      }),
    );

    expect(summary).toMatchObject({ id: '1', href: '/chat/my-app', name: 'Todo app', stack: 'React', messageCount: 1 });
    expect(summary.updatedAt.toISOString()).toBe('2026-10-01T10:00:00.000Z');
  });

  it('falls back to the artifact title, then a placeholder, and survives bad timestamps', () => {
    expect(toProjectSummary(chat({ messages: [assistant('<boltArtifact id="x" title="Weather app">')] })).name).toBe(
      'Weather app',
    );

    const untitled = toProjectSummary(chat({ timestamp: 'nope' }));
    expect(untitled.name).toBe('Untitled app');
    expect(untitled.href).toBe('/chat/1');
    expect(untitled.updatedAt.getTime()).toBe(0);
  });
});

describe('detectStack', () => {
  it.each([
    ['"next": "15"', 'Next.js'],
    ['"expo": "52"', 'Expo'],
    ['"express": "5"', 'Node.js'],
    ['filePath="index.html"', 'HTML'],
    ['plain text', undefined],
  ])('%s -> %s', (text, expected) => {
    expect(detectStack(text)).toBe(expected);
  });
});

describe('filterProjects / sortByRecent', () => {
  const projects = [
    {
      id: 'a',
      href: '',
      name: 'Recipe finder',
      updatedAt: new Date(1),
      messageCount: 1,
      stack: 'Vue',
      location: 'local' as const,
    },
    {
      id: 'b',
      href: '',
      name: 'Kanban',
      updatedAt: new Date(3),
      messageCount: 1,
      stack: 'React',
      location: 'local' as const,
    },
    { id: 'c', href: '', name: 'Blog', updatedAt: new Date(2), messageCount: 1, location: 'local' as const },
  ];

  it('matches name or stack, case-insensitively', () => {
    expect(filterProjects(projects, ' recipe ').map((p) => p.id)).toEqual(['a']);
    expect(filterProjects(projects, 'react').map((p) => p.id)).toEqual(['b']);
    expect(filterProjects(projects, '')).toBe(projects);
  });

  it('orders newest first without mutating the input', () => {
    expect(sortByRecent(projects).map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(projects[0].id).toBe('a');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  it.each([
    [10, 'just now'],
    [60, '1 minute ago'],
    [7200, '2 hours ago'],
    [86400 * 3, '3 days ago'],
    [86400 * 14, '2 weeks ago'],
    [86400 * 400, '1 year ago'],
  ])('%s seconds -> %s', (seconds, expected) => {
    expect(formatRelative(new Date(now.getTime() - seconds * 1000), now)).toBe(expected);
  });
});

describe('mergeCloudProjects', () => {
  const local = [
    {
      id: '1',
      href: '/chat/a',
      name: 'Synced',
      updatedAt: new Date(5),
      messageCount: 2,
      cloudId: 'c1',
      location: 'local' as const,
    },
    {
      id: '2',
      href: '/chat/b',
      name: 'Local only',
      updatedAt: new Date(4),
      messageCount: 2,
      location: 'local' as const,
    },
  ];

  it('marks synced copies and adds cloud-only projects', () => {
    const merged = mergeCloudProjects(local, [
      { id: 'c1', description: 'Synced', timestamp: '2026-10-01T00:00:00Z' },
      { id: 'c2', description: ' Phone app ', timestamp: '2026-10-02T00:00:00Z' },
    ]);

    expect(merged.map((p) => [p.name, p.location, p.href])).toEqual([
      ['Synced', 'synced', '/chat/a'],
      ['Local only', 'local', '/chat/b'],
      ['Phone app', 'cloud', null],
    ]);
    expect(merged[2]).toMatchObject({ id: 'cloud:c2', cloudId: 'c2' });
  });

  it('leaves local projects whose cloud copy was deleted as local', () => {
    expect(mergeCloudProjects(local, []).map((p) => p.location)).toEqual(['local', 'local']);
  });
});
