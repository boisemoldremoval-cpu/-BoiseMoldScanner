# AppForge

Describe an app in plain English and an AI agent builds the working application:
code editor, terminal, live preview, chat, debugging and one-click deploy, all in the
browser.

> The product name, tagline, links, logo and accent colour are configured in one
> place: [`app/config/brand.ts`](app/config/brand.ts) (or the `VITE_BRAND_*`
> variables in `.env.local`) and the `accent` palette in [`uno.config.ts`](uno.config.ts).

AppForge is built on [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) (MIT). See
[NOTICE](NOTICE) for attribution and the WebContainer licensing note.

## Features

| Capability | Status | Where |
| --- | --- | --- |
| Prompt-to-app AI agent | ✅ upstream | `app/lib/.server/llm`, `app/lib/runtime` |
| Code editor (CodeMirror), file tree, diff view | ✅ upstream | `app/components/editor`, `app/components/workbench` |
| Terminal | ✅ upstream | `app/components/workbench/terminal` |
| **Run / Stop** button: install + start the app, output in a **Console** view | ✅ new | `app/lib/runner`, `RunButton.tsx`, `ConsolePanel.tsx` |
| **Secrets**: per-project env vars injected at run time, never written to files | ✅ new | `app/lib/runner/secrets*.ts`, `SecretsPanel.tsx` |
| Live preview | ✅ upstream | `app/components/workbench/Preview.tsx` |
| Debugging: preview/terminal errors and crashed runs → "Ask AI to fix" | ✅ upstream + new | `app/lib/webcontainer/index.ts`, `ChatAlert.tsx` |
| Project saving (browser IndexedDB, snapshots, export/import) | ✅ upstream | `app/lib/persistence` |
| GitHub / GitLab import & push | ✅ upstream | `app/components/git`, `app/components/deploy` |
| Deployment: Netlify, Vercel, GitHub | ✅ upstream | `app/routes/api.*-deploy.ts` |
| Database: Supabase | ✅ upstream | `app/routes/api.supabase*.ts` |
| Claude (Anthropic) + 20 other providers | ✅ upstream | `app/lib/modules/llm/providers` |
| Local open-source models: Ollama, LM Studio, any OpenAI-compatible server | ✅ upstream | same |
| Isolated execution: WebContainer (browser sandbox, per tab) | ✅ upstream | `app/lib/webcontainer` |
| Platform sign-in & cloud project storage | 🚧 planned | see [docs/ROADMAP.md](docs/ROADMAP.md) |
| Server-side container sandbox | 🚧 planned | see [docs/ROADMAP.md](docs/ROADMAP.md) |

## Quick start

Requires Node.js ≥ 22.12 and pnpm ≥ 9.15.

```bash
pnpm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY and/or local model URLs
pnpm dev                     # http://localhost:5173
```

### AI models

- **Claude**: set `ANTHROPIC_API_KEY` in `.env.local`, or paste a key in the model picker.
- **Ollama**: run `ollama serve`, set `OLLAMA_API_BASE_URL=http://127.0.0.1:11434`.
- **LM Studio**: start the local server with CORS enabled, set `LMSTUDIO_API_BASE_URL=http://127.0.0.1:1234`.
- **Any OpenAI-compatible server** (vLLM, llama.cpp, LocalAI, ...): set `OPENAI_LIKE_API_BASE_URL` and `OPENAI_LIKE_API_KEY`.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / preview |
| `pnpm test` | Unit, integration and performance tests (Vitest) |
| `pnpm typecheck` / `pnpm lint` | TypeScript / ESLint |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm run deploy` | Build and deploy to Cloudflare Workers |
| `docker compose --profile production up` | Run in Docker |

## License

MIT, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
