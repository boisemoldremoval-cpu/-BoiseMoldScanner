import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { envOf, getSessionUser, isSameOrigin } from '~/lib/.server/auth/config';
import { storeFromEnv } from '~/lib/.server/storage/kv';
import {
  deleteProject,
  getProject,
  MAX_PROJECT_BYTES,
  ProjectValidationError,
  saveProject,
  validateProject,
} from '~/lib/.server/storage/projects';

const noStore = { 'Cache-Control': 'private, no-store' };

/** GET /api/cloud-project/:id */
export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const env = envOf(context);
  const user = await getSessionUser(request, env);

  if (!user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 });
  }

  const project = await getProject(storeFromEnv(env), user.id, params.id ?? '');

  return project
    ? Response.json({ project }, { headers: noStore })
    : Response.json({ error: 'Not found' }, { status: 404, headers: noStore });
}

/** PUT saves the project, DELETE removes it. */
export async function action({ request, context, params }: ActionFunctionArgs) {
  const env = envOf(context);

  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = await getSessionUser(request, env);

  if (!user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 });
  }

  const store = storeFromEnv(env);
  const id = params.id ?? '';

  try {
    if (request.method === 'DELETE') {
      await deleteProject(store, user.id, id);
      return Response.json({ ok: true });
    }

    if (request.method !== 'PUT') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    if (!request.headers.get('Content-Type')?.includes('application/json')) {
      return Response.json({ error: 'Expected JSON' }, { status: 415 });
    }

    const length = Number(request.headers.get('Content-Length') ?? 0);

    if (length > MAX_PROJECT_BYTES) {
      return Response.json({ error: 'Project is too large to sync' }, { status: 413 });
    }

    const meta = await saveProject(store, user.id, validateProject(await request.json(), id));

    return Response.json({ project: meta });
  } catch (error) {
    if (error instanceof ProjectValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof SyntaxError) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    throw error;
  }
}
