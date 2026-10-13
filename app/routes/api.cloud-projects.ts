import type { LoaderFunctionArgs } from 'react-router';
import { envOf, getSessionUser } from '~/lib/.server/auth/config';
import { storeFromEnv } from '~/lib/.server/storage/kv';
import { listProjects } from '~/lib/.server/storage/projects';

/** GET /api/cloud-projects: the signed-in user's projects (metadata only). */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = envOf(context);
  const user = await getSessionUser(request, env);

  if (!user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 });
  }

  return Response.json(
    { projects: await listProjects(storeFromEnv(env), user.id) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
