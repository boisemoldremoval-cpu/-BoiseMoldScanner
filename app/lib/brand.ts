/*
 * Single source of truth for user-visible branding.
 *
 * Internal identifiers inherited from bolt.diy (CSS tokens such as
 * `bolt-elements-*`, the `boltArtifact`/`boltAction` protocol tags, storage
 * keys) are intentionally left unchanged: renaming them would break saved
 * chats and make it much harder to merge upstream fixes.
 */
export const BRAND = {
  name: 'Buildwright',
  assistantName: 'Buildwright',
  tagline: 'Describe an app in plain English and get a working application.',
  description: 'Buildwright is an AI app builder: describe what you want and an AI agent builds, runs and deploys it.',

  // Used as the User-Agent for outbound API calls and in generated commit messages.
  userAgent: 'buildwright-app',

  // Leave empty to hide the related menu entries.
  docsUrl: '',
  issuesUrl: '',

  // Repository that receives in-app bug reports when BUG_REPORT_REPO is not set.
  bugReportRepo: '',

  // Repository whose package.json is checked for available updates.
  updateCheckRepo: '',
} as const;
