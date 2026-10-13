import { redirect, type LoaderFunctionArgs } from 'react-router';
import { BRAND } from '~/config/brand';
import { envOf, getAuthConfig } from '~/lib/.server/auth/config';
import {
  createSessionToken,
  isSecureRequest,
  OAUTH_STATE_COOKIE,
  readCookie,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  unsignValue,
} from '~/lib/.server/auth/session';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('auth');

/** GitHub redirects here after the user approves sign-in. */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const config = getAuthConfig(envOf(context));

  if (!config) {
    return new Response('Sign-in is not configured on this server.', { status: 404 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const secure = isSecureRequest(request);
  const clearState = serializeCookie(OAUTH_STATE_COOKIE, '', { maxAge: 0, secure, path: '/auth' });

  const storedState = readCookie(request, OAUTH_STATE_COOKIE);
  const verified = storedState ? await unsignValue(storedState, config.sessionSecret) : null;
  const [expectedState, returnTo = '/apps'] = verified?.split('|') ?? [];

  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response('Sign-in failed: invalid or expired state. Please try again.', {
      status: 400,
      headers: { 'Set-Cookie': clearState },
    });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
        redirect_uri: `${url.origin}/auth/github/callback`,
      }),
    });

    const token = (await tokenResponse.json()) as { access_token?: string; error?: string };

    if (!token.access_token) {
      throw new Error(token.error || `token exchange failed (${tokenResponse.status})`);
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': BRAND.userAgent,
      },
    });

    if (!userResponse.ok) {
      throw new Error(`GitHub user lookup failed (${userResponse.status})`);
    }

    const user = (await userResponse.json()) as { id: number; login: string; name?: string; avatar_url?: string };

    /*
     * Only the identity is kept. The OAuth token is discarded, so a leaked
     * session cookie never grants access to the user's GitHub account.
     */
    const session = await createSessionToken(
      { id: `gh-${user.id}`, login: user.login, name: user.name ?? undefined, avatarUrl: user.avatar_url },
      config.sessionSecret,
    );

    const headers = new Headers();
    headers.append('Set-Cookie', clearState);
    headers.append('Set-Cookie', serializeCookie(SESSION_COOKIE, session, { maxAge: SESSION_TTL_SECONDS, secure }));

    return redirect(returnTo, { headers });
  } catch (error) {
    logger.error('GitHub sign-in failed', error);
    return new Response('Sign-in with GitHub failed. Please try again.', {
      status: 502,
      headers: { 'Set-Cookie': clearState },
    });
  }
}
