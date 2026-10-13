import { atom } from 'nanostores';

/**
 * Fired after a project is written to IndexedDB. Kept in its own tiny module so
 * persistence code can announce saves without importing the cloud-sync code
 * (which itself depends on persistence).
 */
export const projectSaved = atom<{ id: string; at: number } | null>(null);
