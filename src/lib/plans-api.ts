/**
 * API client for plans endpoints (packages/mcp/src/api/plans.ts).
 */

export type PlanStatus = 'draft' | 'approved' | 'running' | 'done' | 'failed' | 'archived';
export type PlanStepKind = 'turn' | 'tool_call';
export type PlanStepRunIf = 'on_success' | 'on_failure' | 'always';

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
  run_if: PlanStepRunIf;
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
  /** Réplica contra la que corrió. Null = el root_path del proyecto. */
  replica_id: string | null;
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

/**
 * GET /api/plans?project_id=&status=
 *
 * `status` acepta uno o varios estados; varios viajan como CSV
 * (`status=draft,approved`), que es lo que parsea el controller. Sin `status`
 * (o con lista vacía) vuelve el listado completo del proyecto.
 */
export async function listPlans(projectId: string, status?: PlanStatus | PlanStatus[]): Promise<PlanSummary[]> {
  const params = new URLSearchParams({ project_id: projectId });
  const statuses = status === undefined ? [] : Array.isArray(status) ? status : [status];
  if (statuses.length > 0) params.set('status', statuses.join(','));
  const res = await fetch(`/api/plans?${params.toString()}`);
  return handleResponse<PlanSummary[]>(res);
}

/**
 * GET /api/plans?session_id= — the plans of ONE conversation, newest first.
 * What the rail's Focus card needs: "the plan of this chat", not the project's.
 */
export async function listPlansForSession(sessionId: string): Promise<PlanSummary[]> {
  const res = await fetch(`/api/plans?session_id=${encodeURIComponent(sessionId)}`);
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
  patch: Partial<{
    title: string;
    context: string;
    architecture: string;
    status: PlanStatus;
    steps: unknown[];
    session_id: string | null;
  }>,
): Promise<PlanDetail> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return handleResponse<PlanDetail>(res);
}

/** DELETE /api/plans/:id */
export async function deletePlan(planId: string): Promise<void> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}

/** POST /api/plans/:id/approve */
export async function approvePlan(planId: string): Promise<{ plan: PlanSummary }> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/approve`, { method: 'POST' });
  return handleResponse<{ plan: PlanSummary }>(res);
}

/**
 * POST /api/plans/:id/launch — fire-and-forget, returns immediately with the runId.
 *
 * `replicaId` undefined = corre contra el root_path del proyecto (el
 * comportamiento de siempre); con réplica corre contra su worktree, que es la
 * única forma de que una corrida y el chat del mismo proyecto no se pisen los
 * archivos. La réplica sobrevive a la corrida.
 */
export async function launchPlan(planId: string, replicaId?: string): Promise<{ ok: true; run_id: string }> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(replicaId ? { replica_id: replicaId } : {}),
  });
  return handleResponse<{ ok: true; run_id: string }>(res);
}

/** GET /api/plans/:id/latest-run — resolves the most recent run for a plan */
export async function getLatestPlanRun(planId: string): Promise<{ run: PlanRunSnapshot }> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/latest-run`);
  return handleResponse<{ run: PlanRunSnapshot }>(res);
}

/** GET /api/plan-runs/:runId — snapshot */
export async function getPlanRun(runId: string): Promise<{ run: PlanRunSnapshot; steps: PlanRunStepSnapshot[] }> {
  const res = await fetch(`/api/plan-runs/${encodeURIComponent(runId)}`);
  return handleResponse<{ run: PlanRunSnapshot; steps: PlanRunStepSnapshot[] }>(res);
}

export type PlanAnnotationAnchorKind = 'context' | 'architecture' | 'step';
export type PlanAnnotationStatus = 'pending' | 'sent' | 'resolved';

export interface PlanAnnotation {
  id: string;
  plan_id: string;
  anchor_kind: PlanAnnotationAnchorKind;
  step_id: string | null;
  quote: string;
  range_start: number | null;
  range_end: number | null;
  comment: string;
  status: PlanAnnotationStatus;
  snapshot_before: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CreatePlanAnnotationInput {
  anchor_kind: PlanAnnotationAnchorKind;
  step_id?: string | null;
  quote: string;
  range_start?: number | null;
  range_end?: number | null;
  comment: string;
}

/** GET /api/plans/:id/annotations */
export async function listPlanAnnotations(planId: string): Promise<PlanAnnotation[]> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/annotations`);
  const { annotations } = await handleResponse<{ annotations: PlanAnnotation[] }>(res);
  return annotations;
}

/** POST /api/plans/:id/annotations */
export async function createPlanAnnotation(planId: string, input: CreatePlanAnnotationInput): Promise<PlanAnnotation> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const { annotation } = await handleResponse<{ annotation: PlanAnnotation }>(res);
  return annotation;
}

/** PATCH /api/plans/:id/annotations/:annotationId — edit the comment text */
export async function updatePlanAnnotation(planId: string, annotationId: string, comment: string): Promise<PlanAnnotation> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/annotations/${encodeURIComponent(annotationId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  const { annotation } = await handleResponse<{ annotation: PlanAnnotation }>(res);
  return annotation;
}

/** DELETE /api/plans/:id/annotations/:annotationId */
export async function deletePlanAnnotation(planId: string, annotationId: string): Promise<void> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/annotations/${encodeURIComponent(annotationId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}

/** POST /api/plans/:id/annotations/send — freezes snapshot_before on each and returns the composed chat message */
export async function sendPlanAnnotations(planId: string, annotationIds: string[]): Promise<{ annotations: PlanAnnotation[]; message: string }> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/annotations/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ annotation_ids: annotationIds }),
  });
  return handleResponse<{ annotations: PlanAnnotation[]; message: string }>(res);
}

/** POST /api/plans/:id/annotations/:annotationId/resolve */
export async function resolvePlanAnnotation(planId: string, annotationId: string): Promise<PlanAnnotation> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/annotations/${encodeURIComponent(annotationId)}/resolve`, { method: 'POST' });
  const { annotation } = await handleResponse<{ annotation: PlanAnnotation }>(res);
  return annotation;
}

/** POST /api/plans/:id/annotations/:annotationId/reopen */
export async function reopenPlanAnnotation(planId: string, annotationId: string): Promise<PlanAnnotation> {
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/annotations/${encodeURIComponent(annotationId)}/reopen`, { method: 'POST' });
  const { annotation } = await handleResponse<{ annotation: PlanAnnotation }>(res);
  return annotation;
}
