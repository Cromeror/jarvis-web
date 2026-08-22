/**
 * API client for project replicas (packages/http-api/src/project-replicas).
 *
 * El backend expone el CRUD completo desde siempre; acá había solo el listado,
 * así que crear una réplica requería una tool y elegirla al lanzar un plan era
 * literalmente inalcanzable desde la web (`POST /api/plans/:id/launch` acepta
 * `replica_id` y el front nunca lo mandaba). Ver PlanLaunchDialog.
 */

/**
 * Sentinel for "no replica, run against the project's own root_path" — NOT
 * `null`, because PrimeReact's Dropdown treats an option `value` that's
 * empty (`null`/`undefined`/`''`) as unset and falls back to comparing the
 * whole option object instead, so a `null`-valued option can never match a
 * `null` controlled value and the dropdown renders with nothing selected.
 */
export const ROOT_REPLICA = 'root';

export interface ProjectReplica {
  id: string;
  project_id: string;
  slug: string;
  root_path: string;
  branch: string;
  status: 'creating' | 'active' | 'error' | 'removed';
  created_at: string;
  updated_at: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/projects/:id/replicas — worktree replicas of this project */
export async function listProjectReplicas(projectId: string): Promise<ProjectReplica[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/replicas`);
  const { replicas } = await handleResponse<{ replicas: ProjectReplica[] }>(res);
  return replicas;
}

/**
 * POST /api/projects/:id/replicas — crea el worktree y corre el init hook, así
 * que tarda: el llamador tiene que mostrar estado de espera. El `slug` es
 * lowercase alfanumérico + guiones (lo valida el backend).
 */
export async function createProjectReplica(projectId: string, slug: string): Promise<ProjectReplica> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/replicas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  });
  const { replica } = await handleResponse<{ replica: ProjectReplica }>(res);
  return replica;
}

/** DELETE /api/projects/:id/replicas/:replicaId — borra el worktree. */
export async function removeProjectReplica(projectId: string, replicaId: string): Promise<void> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/replicas/${encodeURIComponent(replicaId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}
