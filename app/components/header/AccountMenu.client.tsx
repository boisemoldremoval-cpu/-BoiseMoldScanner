import { useStore } from '@nanostores/react';
import { useEffect } from 'react';
import '~/lib/projects/cloud-sync';
import { authStore, loadAuth, signInUrl } from '~/lib/stores/auth';

/** "Sign in with GitHub" or the signed-in user's avatar with a sign-out button. Hidden when sign-in is not configured. */
export function AccountMenu() {
  const { status, user, authEnabled } = useStore(authStore);

  useEffect(() => {
    void loadAuth();
  }, []);

  if (status !== 'ready' || !authEnabled) {
    return null;
  }

  if (!user) {
    return (
      <a
        href={signInUrl()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2"
      >
        <span className="i-ph:github-logo" />
        Sign in
      </a>
    );
  }

  return (
    <form method="post" action="/auth/logout" className="flex items-center gap-2">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
      ) : (
        <span className="i-ph:user-circle text-2xl text-bolt-elements-textSecondary" />
      )}
      <span className="hidden sm:inline text-sm text-bolt-elements-textPrimary">{user.login}</span>
      <button
        type="submit"
        title="Sign out"
        className="i-ph:sign-out text-lg text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
      />
    </form>
  );
}
