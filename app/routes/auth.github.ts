import { redirect, type LoaderFunctionArgs } from 'react-router';
import { envOf, getAuthConfig, sanitizeReturnTo } from '~/lib/.server/auth/config';
import {
  isSecureRequest,
  OAUTH_STATE_COOKIE,
  randomToken,
  serializeCookie,
  signValue,
} from '~/lib/.server/auth/session';

/** Starts "Sign in with GitHub". */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const config = getAuthConfig(envOf(context));

  if (!config) {
    return new Response('Sign-in is not configured on this server.', { status: 404 });
  }

  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const state = randomToken();

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', config.githubClientId);
  authorize.searchParams.set('redirect_uri', `${url.origin}/auth/github/callback`);
  authorize.searchParams.set('scope', 'read:user');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'true');

  return redirect(authorize.toString(), {
    headers: {
      'Set-Cookie': serializeCookie(OAUTH_STATE_COOKIE, await signValue(`${state}|${returnTo}`, config.sessionSecret), {
        maxAge: 600,
        secure: isSecureRequest(request),
        path: '/auth',
      }),
    },
  });
}
