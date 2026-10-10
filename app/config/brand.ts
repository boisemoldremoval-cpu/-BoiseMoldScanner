/**
 * Single source of truth for the platform's user-facing branding.
 *
 * Every visible product name, tagline, link and logo in the UI reads from here,
 * so rebranding means editing this file (or setting the VITE_BRAND_* variables
 * in `.env.local`) rather than hunting through components.
 *
 * Internal protocol identifiers inherited from bolt.diy (`boltArtifact`,
 * `boltAction`, the `boltHistory` IndexedDB name, `--bolt-elements-*` CSS
 * variables, the `i-bolt:*` icon set) are deliberately NOT branded: renaming
 * them would break the AI output parser and existing users' saved projects.
 */

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const BRAND = {
  /** Product name shown in the header, page titles, prompts to the user, etc. */
  name: env.VITE_BRAND_NAME || 'AppForge',

  /** Short tagline used in page meta descriptions and the landing hero. */
  tagline: env.VITE_BRAND_TAGLINE || 'Describe an app in plain English. Get a working application.',

  /** Landing page headline. */
  heroTitle: env.VITE_BRAND_HERO_TITLE || 'What do you want to build?',

  /** Organisation shown as author/publisher. */
  company: env.VITE_BRAND_COMPANY || 'AppForge',

  /** Public website, used for "about" links. */
  websiteUrl: env.VITE_BRAND_WEBSITE_URL || 'https://github.com/boisemoldremoval-cpu/-BoiseMoldScanner',

  /** Repository that receives bug reports and is linked from the UI. `owner/name`. */
  githubRepo: env.VITE_BRAND_GITHUB_REPO || 'boisemoldremoval-cpu/-BoiseMoldScanner',

  /** Logo shown in the header (SVG in /public, works on light and dark themes). */
  logoUrl: '/brand/logo.svg',

  /** Square mark used as favicon. */
  markUrl: '/brand/mark.svg',

  /** User-Agent sent to third-party APIs (GitHub, Netlify, Vercel, ...). */
  get userAgent() {
    return `${this.name.replace(/\s+/g, '')}-app`;
  },

  /** Default commit message when the user pushes a project to GitHub/GitLab. */
  get defaultCommitMessage() {
    return `Initial commit from ${this.name}`;
  },
} as const;

export const BRAND_REPO_URL = `https://github.com/${BRAND.githubRepo}`;
