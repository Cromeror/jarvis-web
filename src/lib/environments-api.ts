/**
 * API client for environment-check endpoints (packages/mcp/src/api/environments.ts).
 * Separate system from pipelines-api.ts — see that file's header on the mcp
 * side for why: same execution engine, but a distinct concept (status
 * checks for things that stay running, not build/deploy tasks).
 */

export type EnvironmentRunStatus = 'running' | 'checking' | 'completed' | 'failed' | 'cancelled';

export interface EnvironmentRunSummary {
  id: string;
  project_id: string | null;
  name: string;
  yaml_path: string;
  status: EnvironmentRunStatus;
  started_at: string;
  finished_at: string | null;
}

/**
 * A run belongs to an environment if its name matches exactly (an `Ejecutar`
 * run), the `stop` sequence's name (`packages/http-api/src/environments/environments.controller.ts`
 * suffixes it `"${name} (stop)"` — an `Apagar` run), or the standalone
 * `check` sequence's name (`"${name} (check)"` — a `Verificar` run).
 * Filtering by exact equality alone silently drops shutdown/check runs from
 * the history.
 */
export function runBelongsToEnvironment(run: EnvironmentRunSummary, name: string): boolean {
  return run.name === name || run.name === `${name} (stop)` || run.name === `${name} (check)`;
}

export type EnvironmentLifecycleStatus = 'never-run' | 'running' | 'checking' | 'connected' | 'stopped' | 'failed' | 'stopping';

/**
 * Derives whether an environment is currently up, down, or mid-transition
 * from its most recent run (runs come back newest-first). A run whose name
 * ends in " (stop)" is a shutdown run, not a startup run — its `completed`
 * means the stack went DOWN, the opposite of a startup run's `completed`.
 * A run ending in " (check)" is a standalone health check (the "Verificar"
 * button), not a startup run either.
 *
 * `running`/`checking` cover a startup run still going through its `steps`
 * or `check` phase (see PipelineRunStatus in @jarvis/storage — a run sits in
 * `checking` between `steps` succeeding and its `check` sequence finishing).
 * `connected` is the terminal "known healthy" state: a startup or standalone
 * check run that reached `completed` — distinct from the pre-health-check
 * `running` naming used elsewhere so the UI can say "conectado" only once a
 * real check passed (or, for an environment with no `check` defined, as soon
 * as `steps` completes — completed is completed either way).
 */
export function deriveEnvironmentStatus(runs: EnvironmentRunSummary[]): EnvironmentLifecycleStatus {
  const latest = runs[0];
  if (!latest) return 'never-run';
  const isStopRun = latest.name.endsWith(' (stop)');
  const isCheckRun = latest.name.endsWith(' (check)');

  if (isStopRun) {
    if (latest.status === 'running' || latest.status === 'checking') return 'stopping';
    if (latest.status === 'failed') return 'failed';
    return 'stopped';
  }

  if (isCheckRun) {
    if (latest.status === 'checking' || latest.status === 'running') return 'checking';
    if (latest.status === 'completed') return 'connected';
    if (latest.status === 'failed') return 'failed';
    return 'stopped';
  }

  if (latest.status === 'running') return 'running';
  if (latest.status === 'checking') return 'checking';
  if (latest.status === 'completed') return 'connected';
  if (latest.status === 'failed') return 'failed';
  return 'stopped';
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

/** GET /api/projects/:id/environment-runs — recent runs for this project (or one of its replicas), newest first */
export async function listEnvironmentRuns(projectId: string, replicaId?: string | null): Promise<EnvironmentRunSummary[]> {
  const query = replicaId ? `?replica_id=${encodeURIComponent(replicaId)}` : '';
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environment-runs${query}`);
  return handleResponse<EnvironmentRunSummary[]>(res);
}

/** GET /api/environment-runs — recent runs across every project, newest first */
export async function listAllEnvironmentRuns(): Promise<EnvironmentRunSummary[]> {
  const res = await fetch('/api/environment-runs');
  return handleResponse<EnvironmentRunSummary[]>(res);
}

/** POST /api/projects/:id/environments/:name/run — launch an environment check against the project's root or one of its replicas, fire-and-forget */
export async function runEnvironmentByName(
  projectId: string,
  name: string,
  replicaId?: string | null,
): Promise<{ ok: true; run_id: string }> {
  const query = replicaId ? `?replica_id=${encodeURIComponent(replicaId)}` : '';
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(name)}/run${query}`, {
    method: 'POST',
  });
  return handleResponse<{ ok: true; run_id: string }>(res);
}

/**
 * POST /api/projects/:id/environments/:name/shutdown — runs this
 * environment's deliberate `stop` sequence (not defined for every
 * environment — 400 if it has none). Distinct from stopPipelineRun in
 * pipelines-api.ts, which cancels whatever run is currently in flight.
 */
export async function shutdownEnvironmentByName(
  projectId: string,
  name: string,
  replicaId?: string | null,
): Promise<{ ok: true; run_id: string }> {
  const query = replicaId ? `?replica_id=${encodeURIComponent(replicaId)}` : '';
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(name)}/shutdown${query}`,
    { method: 'POST' },
  );
  return handleResponse<{ ok: true; run_id: string }>(res);
}

/**
 * POST /api/projects/:id/environments/:name/check — runs ONLY this
 * environment's `check` sequence on demand (the "Verificar" button),
 * without re-running `steps` first. 400 if the environment has no `check`
 * defined.
 */
export async function checkEnvironmentByName(
  projectId: string,
  name: string,
  replicaId?: string | null,
): Promise<{ ok: true; run_id: string }> {
  const query = replicaId ? `?replica_id=${encodeURIComponent(replicaId)}` : '';
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(name)}/check${query}`,
    { method: 'POST' },
  );
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
