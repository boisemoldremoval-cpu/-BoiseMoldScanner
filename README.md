# Buildwright

Buildwright is an AI app builder. You describe an app in plain English, and an AI agent writes the code, runs it and shows you a live preview. You can then keep iterating in chat or edit the code yourself.

> **Name and branding:** "Buildwright" is a placeholder. All user-visible branding comes from
> [`app/lib/brand.ts`](app/lib/brand.ts), and the logo files are `public/logo.svg`, `public/favicon.svg`,
> `public/favicon.ico` and `public/apple-touch-icon*.png`.

Buildwright is built on [bolt.diy](https://github.com/stackblitz-labs/bolt.diy), which is MIT licensed. See [NOTICE.md](NOTICE.md) for attribution, and [docs/ROADMAP.md](docs/ROADMAP.md) for what exists today and what is still planned.

## Features available today

- **AI chat agent** that generates and edits full projects. Anthropic Claude is the default provider.
- **Local open-source models** through Ollama, LM Studio, or any OpenAI-compatible server (vLLM, llama.cpp, etc.).
- **Code editor** (CodeMirror), with diff view and file locking.
- **Terminal** and **live preview**, running in a WebContainer that is sandboxed in the user's browser.
- **Error assist:** preview and terminal errors can be sent to the AI to fix.
- **GitHub and GitLab:** import a repo, or push a project to a repo.
- **Deploy** to Netlify or Vercel.
- **Supabase** integration for databases and auth in the apps users generate.
- **Project history:** chats and project snapshots are saved in the browser (IndexedDB), with export and import.

## Getting started

Requirements: Node.js 22.12 or newer, and pnpm 9.

```bash
pnpm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY, and/or OLLAMA_API_BASE_URL etc.
pnpm dev                     # http://localhost:5173
```

API keys can also be entered in the UI, under the provider selector or in Settings → Providers.

### Using a local model

1. Run [Ollama](https://ollama.com) (`ollama serve`) or LM Studio. In LM Studio, enable CORS.
2. Set `OLLAMA_API_BASE_URL=http://127.0.0.1:11434` or `LMSTUDIO_API_BASE_URL=http://127.0.0.1:1234` in `.env.local`, or enable the provider in Settings → Providers → Local.
3. Pick the provider and model in the chat box.

Code generation quality depends heavily on the model. Small local models often fail to follow the artifact format.

## Checks

```bash
pnpm test        # unit, integration and performance tests (vitest)
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e    # Playwright; needs a running app and a model API key
```

## Licensing notes

- Buildwright's own code and the bolt.diy code it is based on are released under the MIT license ([LICENSE](LICENSE)).
- The in-browser runtime uses the StackBlitz **WebContainer API**, which has its own terms. Commercial production use requires a license from StackBlitz: see https://webcontainers.io/enterprise. Sort this out before launching a paid product, or replace the runtime (see roadmap, Stage 4).
