import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Serves the API from the Vite dev server so `pnpm dev` is a single process.
function apiDevServer(): Plugin {
  return {
    name: 'invoices-api',
    apply: 'serve',
    async configureServer(server) {
      const { createApp } = await server.ssrLoadModule('/server/app.ts');
      const { Store } = await server.ssrLoadModule('/server/db.ts');
      const dbPath = process.env.DATABASE_PATH ?? 'data/invoices.db';

      mkdirSync('data', { recursive: true });

      const app = createApp({ store: new Store(dbPath), adminPassword: process.env.ADMIN_PASSWORD || undefined });

      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          app(req, res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), apiDevServer()],
  server: { host: '127.0.0.1', port: 5174 },

  // The demo build swaps the server API for an in-browser copy (src/demo/mockApi.ts).
  resolve:
    mode === 'demo'
      ? { alias: [{ find: /^\.\.?\/api\.ts$/, replacement: fileURLToPath(new URL('./src/demo/mockApi.ts', import.meta.url)) }] }
      : undefined,
  build: mode === 'demo' ? { outDir: 'dist-demo', assetsInlineLimit: 100000 } : undefined,
  test: {
    environment: 'node',
  },
}));
