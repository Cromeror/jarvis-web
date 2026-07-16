/**
 * API client for pipeline management endpoints (packages/mcp/src/api/pipelines.ts).
 */

export type PipelineRunStatus = 'running' | 'completed' | 'failed';

export interface PipelineRunSummary {
  id: string;
  project_id: string | null;
  name: string;
  yaml_path: string;
  status: PipelineRunStatus;
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

/** GET /api/projects/:id/pipelines — YAML pipelines defined for this project */
export async function listPipelineDefinitions(projectId: string): Promise<string[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/pipelines`);
  const { names } = await handleResponse<{ names: string[] }>(res);
  return names;
}

/** GET /api/projects/:id/pipeline-runs — recent runs for this project, newest first */
export async function listPipelineRuns(projectId: string): Promise<PipelineRunSummary[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/pipeline-runs`);
  return handleResponse<PipelineRunSummary[]>(res);
}

/** POST /api/projects/:id/pipelines/:name/run — launch a pipeline, fire-and-forget */
export async function runPipelineByName(projectId: string, name: string): Promise<{ ok: true; run_id: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/pipelines/${encodeURIComponent(name)}/run`, {
    method: 'POST',
  });
  return handleResponse<{ ok: true; run_id: string }>(res);
}
