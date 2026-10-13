import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { BRAND } from '~/config/brand';
import { db, deleteById, duplicateChat, getAll, updateChatDescription } from '~/lib/persistence';
import {
  filterProjects,
  formatRelative,
  sortByRecent,
  toProjectSummary,
  type ProjectSummary,
} from '~/lib/projects/projects';
import { classNames } from '~/utils/classNames';
import { STARTER_TEMPLATES } from '~/utils/constants';

const IDEAS = ['A habit tracker with streaks', 'A recipe finder with search', 'A Kanban board', 'A portfolio site'];

/** Replit-style home: start a new app from a prompt or template, and manage saved apps. */
export function AppsDashboard() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [prompt, setPrompt] = useState('');

  const load = useCallback(async () => {
    if (!db) {
      setProjects([]);
      return;
    }

    try {
      const items = await getAll(db);
      setProjects(sortByRecent(items.filter((item) => item.messages?.length).map(toProjectSummary)));
    } catch (error) {
      console.error('Failed to load projects', error);
      toast.error('Could not load your apps');
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => filterProjects(projects ?? [], query), [projects, query]);

  const start = (text: string) => {
    const trimmed = text.trim();

    if (trimmed) {
      window.location.href = `/?prompt=${encodeURIComponent(trimmed)}`;
    }
  };

  const rename = async (project: ProjectSummary) => {
    const name = window.prompt('Rename app', project.name)?.trim();

    if (!name || !db || name === project.name) {
      return;
    }

    await updateChatDescription(db, project.id, name);
    await load();
  };

  const duplicate = async (project: ProjectSummary) => {
    if (!db) {
      return;
    }

    await duplicateChat(db, project.id);
    toast.success(`Duplicated ${project.name}`);
    await load();
  };

  const remove = async (project: ProjectSummary) => {
    if (!db || !window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      return;
    }

    await deleteById(db, project.id);
    toast.success(`Deleted ${project.name}`);
    await load();
  };

  return (
    <div className="flex-1 overflow-y-auto modern-scrollbar">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <section className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-bolt-elements-textPrimary">Create a new app</h1>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              start(prompt);
            }}
          >
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={`Describe your app and ${BRAND.name} will build it…`}
              aria-label="Describe your app"
              className="flex-1 px-4 py-3 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-accent-500"
            />
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="px-5 py-3 rounded-lg bg-accent-500 hover:bg-accent-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="i-ph:sparkle-fill" />
              Start building
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => start(idea)}
                className="px-3 py-1 text-xs rounded-full border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-accent-500"
              >
                {idea}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">
              My Apps{projects ? ` (${projects.length})` : ''}
            </h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search apps"
              aria-label="Search apps"
              className="w-full sm:w-64 px-3 py-1.5 text-sm rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-accent-500"
            />
          </div>

          {projects === null ? (
            <p className="text-sm text-bolt-elements-textTertiary">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-bolt-elements-textTertiary">
              No apps yet. Describe one above or pick a template to get started.
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-bolt-elements-textTertiary">No apps match “{query}”.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visible.map((project) => (
                <li
                  key={project.id}
                  className="flex flex-col rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-accent-500 transition-colors"
                >
                  <a href={project.href} className="flex-1 p-4 space-y-1">
                    <span className="block font-medium text-bolt-elements-textPrimary truncate">{project.name}</span>
                    <span className="flex items-center gap-2 text-xs text-bolt-elements-textTertiary">
                      {project.stack && (
                        <span className="px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary">
                          {project.stack}
                        </span>
                      )}
                      Edited {formatRelative(project.updatedAt)}
                    </span>
                  </a>
                  <div className="flex items-center gap-1 px-3 py-2 border-t border-bolt-elements-borderColor">
                    <a
                      href={project.href}
                      className="mr-auto text-xs font-medium text-accent-500 hover:text-accent-600 flex items-center gap-1"
                    >
                      <span className="i-ph:play-fill" /> Open
                    </a>
                    <ActionButton icon="i-ph:pencil-simple" label="Rename" onClick={() => rename(project)} />
                    <ActionButton icon="i-ph:copy" label="Duplicate" onClick={() => duplicate(project)} />
                    <ActionButton icon="i-ph:trash" label="Delete" danger onClick={() => remove(project)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Start from a template</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STARTER_TEMPLATES.map((template) => (
              <a
                key={template.name}
                href={`/git?url=https://github.com/${template.githubRepo}.git`}
                className="group flex gap-3 p-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-accent-500 transition-colors"
              >
                <span className={classNames(template.icon, 'w-8 h-8 shrink-0 text-3xl')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-bolt-elements-textPrimary group-hover:text-accent-500">
                    {template.label}
                  </span>
                  <span className="block text-xs text-bolt-elements-textTertiary line-clamp-2">
                    {template.description}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={classNames(
        icon,
        'w-7 h-7 p-1.5 rounded text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3',
        danger ? 'hover:text-red-500' : 'hover:text-bolt-elements-textPrimary',
      )}
    />
  );
}
