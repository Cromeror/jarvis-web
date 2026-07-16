/**
 * API client for plans endpoints (packages/mcp/src/api/plans.ts).
 */

export type PlanStatus = 'draft' | 'approved' | 'running' | 'done' | 'failed' | 'archived';
export type PlanStepKind = 'note' | 'tool_call';

export interface PlanSummary {
  id: string;
  project_id: string | null;
  session_id: string | null;
  title: string;
  context: string;
  architecture: string;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export interface PlanStepWithDependencies {
  id: number;
  plan_id: string;
  step_id: string;
  step_index: number;
  kind: PlanStepKind;
  description: string;
  tool_name: string | null;
  tool_input: string | null;
  created_at: string;
  dependsOn: string[];
}

export interface PlanDetail {
  plan: PlanSummary;
  steps: PlanStepWithDependencies[];
}

export interface PlanRunSnapshot {
  id: string;
  plan_id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  finished_at: string | null;
}

export interface PlanRunStepSnapshot {
  id: number;
  run_id: string;
  plan_step_id: number;
  step_id: string;
  step_index: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
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

/** GET /api/plans?project_id=&status= */
export async function listPlans(projectId: string, status?: PlanStatus): Promise<PlanSummary[]> {
  const params = new URLSearchParams({ project_id: projectId });
  if (status) params.set('status', status);
  const res = await fetch(`/api/plans?${params.toString()}`);
  return handleResponse<PlanSummary[]>(res);
}

/** GET /api/plans/:id — plan + full step graph */
export async function getPlan(planId: string): Promise<PlanDetail> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}`);
  return handleResponse<PlanDetail>(res);
}

/** PATCH /api/plans/:id — edit title/context/architecture/status/steps */
export async function updatePlan(
  planId: string,
  patch: Partial<{ title: string; context: string; architecture: string; status: PlanStatus; steps: unknown[] }>,
): Promise<PlanDetail> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return handleResponse<PlanDetail>(res);
}

/** POST /api/plans/:id/approve */
export async function approvePlan(planId: string): Promise<{ plan: PlanSummary }> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/approve`, { method: 'POST' });
  return handleResponse<{ plan: PlanSummary }>(res);
}

/** POST /api/plans/:id/launch — fire-and-forget, returns immediately */
export async function launchPlan(planId: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/launch`, { method: 'POST' });
  return handleResponse<{ ok: true }>(res);
}

/** GET /api/plan-runs/:runId — snapshot */
export async function getPlanRun(runId: string): Promise<{ run: PlanRunSnapshot; steps: PlanRunStepSnapshot[] }> {
  const res = await fetch(`/api/plan-runs/${encodeURIComponent(runId)}`);
  return handleResponse<{ run: PlanRunSnapshot; steps: PlanRunStepSnapshot[] }>(res);
}
