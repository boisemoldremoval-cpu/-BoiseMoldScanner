import { mkdirSync } from 'node:fs';
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

export default defineConfig({
  plugins: [react(), apiDevServer()],
  server: { host: '127.0.0.1', port: 5174 },
  test: {
    environment: 'node',
  },
});
