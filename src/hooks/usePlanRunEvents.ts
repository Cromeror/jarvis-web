import { useEffect, useState } from 'react';
import type { PlanRunStepSnapshot } from '../lib/plans-api.js';

interface PlanRunSseEvent {
  event: 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'run_completed' | 'run_failed';
  run_id: string;
  changed_step_id: string | null;
  steps: PlanRunStepSnapshot[];
  active_step_ids: string[];
  run_status: 'running' | 'completed' | 'failed';
}

/**
 * Subscribes to real-time progress for a plan run via SSE
 * (GET /api/plan-runs/:runId/events). Unlike usePipelineEvents, the plan
 * runner emits a FULL snapshot of every step on each event (not a single
 * changed step) — parallel execution means several steps can be 'running'
 * at once, so the client needs the whole picture every time rather than
 * reconstructing it from incremental deltas.
 */
export function usePlanRunEvents(runId: string | null) {
  const [steps, setSteps] = useState<PlanRunStepSnapshot[]>([]);
  const [runStatus, setRunStatus] = useState<'running' | 'completed' | 'failed'>('running');
  const [activeStepIds, setActiveStepIds] = useState<string[]>([]);

  useEffect(() => {
    if (!runId) return;

    let cancelled = false;

    fetch(`/api/plan-runs/${runId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { run: { status: 'running' | 'completed' | 'failed' }; steps: PlanRunStepSnapshot[] } | null) => {
        if (cancelled || !data) return;
        setSteps(data.steps);
        setRunStatus(data.run.status);
      })
      .catch(() => { /* snapshot best-effort — SSE will still fill in state */ });

    const es = new EventSource(`/api/plan-runs/${runId}/events`);
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as PlanRunSseEvent;
        setSteps(data.steps);
        setActiveStepIds(data.active_step_ids);
        setRunStatus(data.run_status);
        if (data.event === 'run_completed' || data.event === 'run_failed') {
          es.close();
        }
      } catch { /* ignore malformed events */ }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [runId]);

  return { steps, runStatus, activeStepIds };
}
