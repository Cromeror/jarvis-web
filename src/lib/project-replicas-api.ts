/**
 * API client for project replicas (packages/http-api/src/project-replicas).
 * Read-only from the web-app side for now — creation/removal happens via
 * jarvis_run_tool, not the UI.
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
