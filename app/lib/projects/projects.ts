import type { ChatHistoryItem } from '~/lib/persistence/useChatHistory';

/** What the "My Apps" dashboard shows for each saved project. */
export interface ProjectSummary {
  id: string;

  /** Where to open it; null for a cloud-only project that must be downloaded first. */
  href: string | null;
  name: string;
  updatedAt: Date;
  messageCount: number;
  stack?: string;

  /** Id in the signed-in user's cloud storage, if it has ever synced. */
  cloudId?: string;

  /** 'local' = this browser only, 'synced' = also in the cloud, 'cloud' = only in the cloud. */
  location: 'local' | 'synced' | 'cloud';
}

export interface CloudProjectMeta {
  id: string;
  urlId?: string;
  description?: string;
  timestamp: string;
}

const ARTIFACT_TITLE = /<boltArtifact[^>]*\btitle="([^"]+)"/;

function textOf(message: ChatHistoryItem['messages'][number]): string {
  const parts = (message as { parts?: Array<{ type: string; text?: string }> }).parts ?? [];
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('');
}

/** Picks a coarse stack label from the files the AI wrote, for the project card. */
export function detectStack(text: string): string | undefined {
  const checks: Array<[RegExp, string]> = [
    [/expo|react-native/i, 'Expo'],
    [/next\.config|"next":/i, 'Next.js'],
    [/astro\.config|"astro":/i, 'Astro'],
    [/svelte\.config|"svelte":/i, 'Svelte'],
    [/"vue":|\.vue"/i, 'Vue'],
    [/"react":/i, 'React'],
    [/"express":/i, 'Node.js'],
    [/filePath="[^"]*\.html"/i, 'HTML'],
  ];

  return checks.find(([pattern]) => pattern.test(text))?.[1];
}

export function toProjectSummary(item: ChatHistoryItem): ProjectSummary {
  const assistantText = item.messages
    .filter((m) => m.role === 'assistant')
    .map(textOf)
    .join('\n');

  const artifactTitle = assistantText.match(ARTIFACT_TITLE)?.[1];
  const timestamp = new Date(item.timestamp);

  return {
    id: item.id,
    href: `/chat/${item.urlId ?? item.id}`,
    name: item.description?.trim() || artifactTitle || 'Untitled app',
    updatedAt: Number.isNaN(timestamp.getTime()) ? new Date(0) : timestamp,
    messageCount: item.messages.length,
    stack: detectStack(assistantText),
    cloudId: item.metadata?.cloudId,
    location: 'local',
  };
}

/**
 * Combines this browser's projects with the user's cloud projects: local
 * copies that exist in the cloud are marked 'synced', and cloud projects not
 * present locally are added as 'cloud' entries.
 */
export function mergeCloudProjects(local: ProjectSummary[], cloud: CloudProjectMeta[]): ProjectSummary[] {
  const cloudIds = new Set(cloud.map((project) => project.id));
  const localCloudIds = new Set(local.map((project) => project.cloudId).filter(Boolean));

  const merged: ProjectSummary[] = local.map((project) =>
    project.cloudId && cloudIds.has(project.cloudId) ? { ...project, location: 'synced' } : { ...project },
  );

  for (const project of cloud) {
    if (localCloudIds.has(project.id)) {
      continue;
    }

    const timestamp = new Date(project.timestamp);
    merged.push({
      id: `cloud:${project.id}`,
      href: null,
      name: project.description?.trim() || 'Untitled app',
      updatedAt: Number.isNaN(timestamp.getTime()) ? new Date(0) : timestamp,
      messageCount: 0,
      cloudId: project.id,
      location: 'cloud',
    });
  }

  return merged;
}

export function filterProjects(projects: ProjectSummary[], query: string): ProjectSummary[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return projects;
  }

  return projects.filter(
    (project) => project.name.toLowerCase().includes(needle) || project.stack?.toLowerCase().includes(needle),
  );
}

export function sortByRecent(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function formatRelative(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const units: Array<[number, string]> = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
    [2592000, 'month'],
    [31536000, 'year'],
  ];

  let [size, label] = units[0];

  for (const unit of units) {
    if (seconds >= unit[0]) {
      [size, label] = unit;
    }
  }

  const value = Math.floor(seconds / size);

  return `${value} ${label}${value === 1 ? '' : 's'} ago`;
}
