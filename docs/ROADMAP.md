# Roadmap

This roadmap tracks Buildwright against the target feature set and lays out the remaining work in stages. Each stage should land with tests passing and existing behaviour preserved.

## Status by capability

| Capability | Status | Notes |
|---|---|---|
| Describe an app → working app | ✅ Inherited | Chat agent emits files and shell actions, which run in the WebContainer |
| Code editor | ✅ Inherited | CodeMirror, diff view, file locking |
| Terminal | ✅ Inherited | xterm.js attached to the WebContainer shell |
| Live preview | ✅ Inherited | Includes a device-frame preview and Expo QR codes |
| AI chat | ✅ Inherited | Build mode and discuss mode, plus MCP tools |
| Claude support | ✅ Stage 2 | Default provider; current model list; sampling-param fix |
| Local open-source models | ✅ Inherited | Ollama, LM Studio, OpenAI-compatible endpoints |
| Debugging | 🟡 Partial | "Ask AI to fix" for preview and terminal errors, plus a debug log. No breakpoints or inspector |
| Project saving | 🟡 Partial | Saved in the browser (IndexedDB) only, so it doesn't sync across devices and there are no accounts |
| GitHub import/export | ✅ Inherited | Clone and push for GitHub and GitLab |
| Databases | 🟡 Partial | Supabase connection only; nothing is built into the platform |
| Authentication | 🔴 Missing | No platform user accounts. Generated apps can use Supabase Auth |
| Deployment | ✅ Inherited | Netlify and Vercel |
| Isolated code execution | 🟡 Partial | WebContainer: a browser sandbox in the user's own tab, Node.js only, with commercial licensing terms |
| Own branding | ✅ Stage 1 | Central `app/lib/brand.ts`, new logo, rebranded prompts and strings |

## Completed

### Stage 0: Import and baseline

- Imported bolt.diy at `10d94fb` (MIT license and attribution kept).
- `pnpm install`, `pnpm typecheck`, `pnpm lint` and `pnpm build` all pass.
- Baseline: 450/451 tests passed. The one failure was a sub-millisecond timing assertion in `tests/performance/streaming-performance.perf.test.tsx`; it passed on 3/3 re-runs, so it's an upstream flake.

### Stage 1: Branding

- `app/lib/brand.ts` holds the product name, the assistant name, the tagline, the user-agent, and optional docs, issues, bug-report and update-check URLs. When a URL is empty, its menu entry is hidden.
- Changed: the header wordmark, favicon and app icons, page titles, the chat placeholder, error-assist dialogs, the terminal tab label, commit messages pushed to user repos, the PDF event-log export and outbound API user-agents.
- The AI introduces itself by the brand name. The discuss prompt no longer points users at bolt.new's support site.
- Deliberately unchanged: internal identifiers such as the `bolt-elements-*` CSS tokens, the `boltArtifact`/`boltAction` protocol tags and the storage keys. Renaming them would break saved chats and make upstream merges painful.

### Stage 2: Claude as the default

- Anthropic is now the default provider, and the default model is `claude-opus-5-5`.
- The static model list is current: Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1, Opus 5, Sonnet 5, Opus 4.8, Sonnet 4.6 and Haiku 4.5. Retired 3.x and 4.0 IDs were removed.
- Bug fix: the dynamic model list read the output cap (`max_tokens`) as the context window. It now uses `max_input_tokens`.
- Bug fix: `/api/llmcall` sent `temperature: 0` to every model. Current Claude models reject sampling parameters with a 400, so `rejectsSamplingParams()` now strips them for those models in both `/api/llmcall` and the chat stream.

## Next stages

These stages depend on choices that are still open (listed at the end of this file).

### Stage 3: Accounts and cloud project storage

- Platform sign-up and sign-in, with sessions as HTTP-only cookies.
- A server-side project store that holds chats, file snapshots and settings for each user. Keep IndexedDB as an offline cache and migrate local projects on first sign-in.
- Store per-user provider API keys encrypted at rest, and stop relying only on browser cookies.
- Tests: auth flows, project CRUD, and access control (one user must never be able to read another's project).

### Stage 4: Isolated server-side execution

- Add a `Runtime` interface behind the current WebContainer calls: filesystem, spawn, ports/preview and events.
- Implement a server sandbox backend: one container or microVM per project, using Docker with gVisor, Firecracker, or a hosted sandbox such as E2B or Daytona. It needs CPU, memory and disk quotas, network egress limits, an idle timeout, no host mounts, and a preview served through a per-sandbox proxy on a separate origin.
- Keep WebContainer as an option. The server backend removes the WebContainer licensing dependency and adds Python and other languages.

### Stage 5: Built-in databases

- Provision a database per project (Postgres schema or SQLite/libSQL) and inject the connection string into the sandbox and the deploy environment.
- Add a database browser panel and teach the agent the provisioned database and its auth helpers.

### Stage 6: Debugging and hardening

- Capture runtime errors and console output from the preview into the chat context automatically, and add an agent loop that tries to fix them.
- Rate limits, usage metering per user, an audit log and abuse controls for public sign-up.
- Extend e2e coverage to the full journey: sign in → describe app → preview → save → deploy.

## Open decisions

1. **Product name and logo.** Buildwright is a placeholder.
2. **Hosting target for the platform.** The repo deploys to Cloudflare Pages by default (`wrangler`); Docker and Node are also supported. This affects the database and sandbox choices.
3. **Auth approach.** Self-hosted (for example Better Auth or Lucia with Postgres) or a hosted provider (Clerk, Supabase Auth, Auth0).
4. **Sandbox backend.** Self-host containers or microVMs, or use a hosted sandbox API. Self-hosting is cheaper at scale but has a much larger security surface.
5. **WebContainer licensing.** Get a commercial license from StackBlitz, or make the server sandbox the default before launch.
