/**
 * API client for environment-check endpoints (packages/mcp/src/api/environments.ts).
 * Separate system from pipelines-api.ts — see that file's header on the mcp
 * side for why: same execution engine, but a distinct concept (status
 * checks for things that stay running, not build/deploy tasks).
 */

export type EnvironmentRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

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

/** GET /api/environment-runs — recent runs across every project, newest first */
export async function listAllEnvironmentRuns(): Promise<EnvironmentRunSummary[]> {
  const res = await fetch('/api/environment-runs');
  return handleResponse<EnvironmentRunSummary[]>(res);
}

/** POST /api/projects/:id/environments/:name/run — launch an environment check, fire-and-forget */
export async function runEnvironmentByName(projectId: string, name: string): Promise<{ ok: true; run_id: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(name)}/run`, {
    method: 'POST',
  });
  return handleResponse<{ ok: true; run_id: string }>(res);
}

/** GET /api/projects/:id/environments/:name — raw YAML content of one environment definition */
export async function getEnvironmentDefinition(projectId: string, name: string): Promise<{ name: string; content: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(name)}`);
  return handleResponse<{ name: string; content: string }>(res);
}

/** POST /api/projects/:id/environments — create a new environment definition */
export async function createEnvironmentDefinition(
  projectId: string,
  name: string,
  content: string,
): Promise<{ name: string; content: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  });
  return handleResponse<{ name: string; content: string }>(res);
}

/** PUT /api/projects/:id/environments/:name — overwrite an environment definition's YAML */
export async function updateEnvironmentDefinition(
  projectId: string,
  name: string,
  content: string,
): Promise<{ name: string; content: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return handleResponse<{ name: string; content: string }>(res);
}

/** DELETE /api/projects/:id/environments/:name — remove an environment definition */
export async function deleteEnvironmentDefinition(projectId: string, name: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}
