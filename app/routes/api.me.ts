import type { LoaderFunctionArgs } from 'react-router';
import { envOf, getAuthConfig, getSessionUser } from '~/lib/.server/auth/config';

/** The signed-in user (or null) and whether sign-in is available on this server. */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context);

  return Response.json(
    { user: await getSessionUser(request, env), authEnabled: getAuthConfig(env) !== null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
