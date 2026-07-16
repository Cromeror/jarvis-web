/**
 * API client for environment-check endpoints (packages/mcp/src/api/environments.ts).
 * Separate system from pipelines-api.ts — see that file's header on the mcp
 * side for why: same execution engine, but a distinct concept (status
 * checks for things that stay running, not build/deploy tasks).
 */

export type EnvironmentRunStatus = 'running' | 'completed' | 'failed';

export interface EnvironmentRunSummary {
  id: string;
  project_id: string | null;
  name: string;
  yaml_path: string;
  status: EnvironmentRunStatus;
  started_at: string;
  finished_at: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/projects/:id/environments — YAML environment checks defined for this project */
export async function listEnvironmentDefinitions(projectId: string): Promise<string[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environments`);
  const { names } = await handleResponse<{ names: string[] }>(res);
  return names;
}

/** GET /api/projects/:id/environment-runs — recent runs for this project, newest first */
export async function listEnvironmentRuns(projectId: string): Promise<EnvironmentRunSummary[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environment-runs`);
  return handleResponse<EnvironmentRunSummary[]>(res);
}

/** POST /api/projects/:id/environments/:name/run — launch an environment check, fire-and-forget */
export async function runEnvironmentByName(projectId: string, name: string): Promise<{ ok: true; run_id: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(name)}/run`, {
    method: 'POST',
  });
  return handleResponse<{ ok: true; run_id: string }>(res);
}
