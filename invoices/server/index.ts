import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.ts';
import { Store } from './db.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DATABASE_PATH ?? join(root, 'data', 'invoices.db');
const port = Number(process.env.PORT ?? 3000);
const adminPassword = process.env.ADMIN_PASSWORD || undefined;

// Without a password the owner API is open, so only allow local connections.
const host = process.env.HOST ?? (adminPassword ? '0.0.0.0' : '127.0.0.1');

if (!adminPassword && host !== '127.0.0.1' && host !== 'localhost') {
  console.error('Refusing to listen on a public address without ADMIN_PASSWORD set.');
  process.exit(1);
}

mkdirSync(dirname(dbPath), { recursive: true });

const store = new Store(dbPath);
const app = createApp({ store, adminPassword });
const dist = join(root, 'dist');

if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(port, host, () => {
  console.log(`Invoices running at http://${host}:${port}${adminPassword ? '' : ' (no password, local only)'}`);
});
