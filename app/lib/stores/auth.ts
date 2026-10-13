import { atom } from 'nanostores';

export interface AuthUser {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface AuthState {
  status: 'loading' | 'ready';
  user: AuthUser | null;
  authEnabled: boolean;
}

export const authStore = atom<AuthState>({ status: 'loading', user: null, authEnabled: false });

let pending: Promise<AuthState> | undefined;

/** Loads the session once per page; safe to call from many components. */
export function loadAuth(): Promise<AuthState> {
  type MeResponse = { user: AuthUser | null; authEnabled: boolean };

  const signedOut: MeResponse = { user: null, authEnabled: false };

  pending ??= fetch('/api/me', { credentials: 'same-origin' })
    .then((response) => (response.ok ? (response.json() as Promise<MeResponse>) : signedOut))
    .catch(() => signedOut)
    .then((data) => {
      const state: AuthState = { status: 'ready', user: data.user ?? null, authEnabled: !!data.authEnabled };
      authStore.set(state);

      return state;
    });

  return pending;
}

export function signInUrl(returnTo = typeof window === 'undefined' ? '/apps' : window.location.pathname) {
  return `/auth/github?returnTo=${encodeURIComponent(returnTo)}`;
}
