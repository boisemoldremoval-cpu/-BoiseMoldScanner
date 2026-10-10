# AppForge roadmap

Stages build on the bolt.diy foundation without breaking its existing
behaviour. Each stage lands as its own commit(s) with tests, typecheck, lint
and build passing.

## Done

| Stage | What |
| --- | --- |
| 0 | Import bolt.diy (`stackblitz-labs/bolt.diy@10d94fb`), install, baseline tests (451 tests; typecheck, lint, build green). |
| 1 | Independent branding through `app/config/brand.ts` + `VITE_BRAND_*`, new logo/mark, accent palette, README/NOTICE, upstream release workflows removed. |
| 2 | Claude as default provider (`claude-opus-5-5`), current Claude model list, fix for sampling params rejected by current Claude models. Local models (Ollama, LM Studio, OpenAI-compatible) unchanged and documented. |

## Already provided by the foundation

Code editor, terminal, live preview, AI chat, preview/terminal error capture
with "Ask AI to fix", project snapshots in IndexedDB with export/import,
GitHub/GitLab import and push, Netlify/Vercel deploy, Supabase database
integration, MCP tools, 20+ AI providers. Code runs in a WebContainer: an
in-browser sandbox, isolated per tab, so generated code never runs on the
platform's servers.

## Next stages

### Stage 3: platform accounts (authentication)

Today there is no sign-in; everything lives in the visitor's browser.

- Sign-in with GitHub OAuth and email magic links; session cookie (HttpOnly,
  Secure, SameSite=Lax), CSRF protection on mutating routes.
- `requireUser()` loader/action helper; per-user rate limits on `/api/chat`
  and `/api/llmcall`.
- Optional: platform-provided Claude key with per-user usage metering, so end
  users do not need their own API key.

### Stage 4: cloud project saving

- Server-side `projects` and `project_snapshots` tables keyed by user;
  autosave the existing snapshot format (`app/lib/persistence`) alongside
  IndexedDB, so offline use keeps working.
- Project list, rename, duplicate, delete, share-read-only link.
- Migration: on first sign-in, offer to upload existing local projects.

### Stage 5: databases and auth for generated apps

- Keep Supabase; add a "provision database" action for a platform-managed
  Postgres (e.g. Neon) per project, with connection secrets injected as env
  vars rather than written into source.
- Prompt templates that scaffold auth (Supabase Auth / Auth.js) in generated
  apps.

### Stage 6: server-side isolated runtimes (optional)

WebContainer covers Node.js/front-end stacks in the browser. For Python,
native binaries, long-running back ends, or to avoid the WebContainer
commercial license (see NOTICE):

- Runtime interface in front of `app/lib/webcontainer` with two
  implementations: WebContainer (current) and remote sandbox.
- Remote sandbox per project in gVisor/Firecracker microVMs (self-hosted, or
  a managed provider such as E2B/Daytona/Modal), no host mounts, egress
  allowlist, CPU/memory/time quotas, idle shutdown.
- Terminal/preview/file-sync over an authenticated WebSocket.

### Stage 7: deployment and hardening

- One-click deploy to the platform's own hosting (Cloudflare Workers/Pages
  for static/edge apps; containers for full-stack).
- Audit logging, secret scanning before GitHub push, CSP for the preview
  frame, end-to-end tests for the new flows.

## Decisions needed

1. **Brand name and domain**: the placeholder is "AppForge"; change it in
   `app/config/brand.ts` or with `VITE_BRAND_NAME`.
2. **Hosting**: Cloudflare Workers (current default; points stages 3-4 at
   D1 + KV) or a Node/Docker host (points them at Postgres).
3. **WebContainer license**: buy a StackBlitz commercial license, or
   prioritise stage 6 to run code on your own sandboxes.
4. **Who pays for AI**: users bring their own API keys (current behaviour),
   or the platform provides the key and meters usage.
