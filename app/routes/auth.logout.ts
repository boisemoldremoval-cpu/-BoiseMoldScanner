import { redirect, type ActionFunctionArgs } from 'react-router';
import { isSameOrigin } from '~/lib/.server/auth/config';
import { isSecureRequest, serializeCookie, SESSION_COOKIE } from '~/lib/.server/auth/session';

export async function action({ request }: ActionFunctionArgs) {
  if (!isSameOrigin(request)) {
    return new Response('Forbidden', { status: 403 });
  }

  return redirect('/', {
    headers: { 'Set-Cookie': serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: isSecureRequest(request) }) },
  });
}

export const loader = () => redirect('/');
