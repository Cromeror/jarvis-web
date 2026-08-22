import { useEffect, useState } from 'react';
import type { PlanRunStepSnapshot } from '../lib/plans-api.js';

/** Coarse lifecycle event — carries a full snapshot of every step. */
interface PlanRunSnapshotEvent {
  event: 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'run_completed' | 'run_failed';
  run_id: string;
  changed_step_id: string | null;
  steps: PlanRunStepSnapshot[];
  active_step_ids: string[];
  run_status: 'running' | 'completed' | 'failed';
}

/** Fine-grained mid-turn output from a running 'note' step. */
interface PlanStepProgressEvent {
  event: 'step_progress';
  run_id: string;
  step_id: string;
  kind: 'assistant_text' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: string;
}

type PlanRunSseEvent = PlanRunSnapshotEvent | PlanStepProgressEvent;

const TERMINAL_STATUSES: ReadonlySet<PlanRunStepSnapshot['status']> = new Set(['completed', 'failed', 'skipped']);

/** Append one progress chunk to a step's live-text buffer. Assistant text is a continuation; tool activity gets its own line. */
function appendChunk(prev: string, ev: PlanStepProgressEvent): string {
  if (ev.kind === 'assistant_text') return prev + ev.content;
  const sep = prev && !prev.endsWith('\n') ? '\n' : '';
  return `${prev}${sep}${ev.content}\n`;
}

/** Drop live text for any step that has reached a terminal status. Returns the same object when nothing changed (avoids a needless re-render). */
function clearFinished(prev: Record<string, string>, steps: PlanRunStepSnapshot[]): Record<string, string> {
  const terminal = new Set(steps.filter((s) => TERMINAL_STATUSES.has(s.status)).map((s) => s.step_id));
  const surviving = Object.keys(prev).filter((id) => !terminal.has(id));
  if (surviving.length === Object.keys(prev).length) return prev;
  return Object.fromEntries(surviving.map((id) => [id, prev[id]]));
}

/**
 * Subscribes to real-time progress for a plan run via SSE
 * (GET /api/plan-runs/:runId/events). Unlike usePipelineEvents, the plan
 * runner emits a FULL snapshot of every step on each lifecycle event (not a
 * single changed step) — parallel execution means several steps can be
 * 'running' at once, so the client needs the whole picture every time rather
 * than reconstructing it from incremental deltas.
 *
 * The same SSE stream also carries fine-grained `step_progress` events (partial
 * assistant text / tool activity from a running 'note' step). Those never touch
 * the step grid — they only accumulate into `stepProgress`, a per-active-step_id
 * live-text buffer that is reset once the step reaches a terminal status
 * (completed/failed/skipped), so a finished step never shows stale live text.
 */
export function usePlanRunEvents(runId: string | null) {
  const [steps, setSteps] = useState<PlanRunStepSnapshot[]>([]);
  const [runStatus, setRunStatus] = useState<'running' | 'completed' | 'failed'>('running');
  const [activeStepIds, setActiveStepIds] = useState<string[]>([]);
  const [stepProgress, setStepProgress] = useState<Record<string, string>>({});
  /**
   * Réplica contra la que corre, del snapshot inicial. No viaja en los eventos
   * SSE (es fijo para toda la corrida) y null = el root del proyecto.
   */
  const [replicaId, setReplicaId] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;

    let cancelled = false;
    setStepProgress({}); // fresh run — drop any live text carried over from a previous runId

    fetch(`/api/plan-runs/${runId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { run: { status: 'running' | 'completed' | 'failed'; replica_id: string | null }; steps: PlanRunStepSnapshot[] } | null) => {
        if (cancelled || !data) return;
        setSteps(data.steps);
        setRunStatus(data.run.status);
        setReplicaId(data.run.replica_id ?? null);
      })
      .catch(() => { /* snapshot best-effort — SSE will still fill in state */ });

    const es = new EventSource(`/api/plan-runs/${runId}/events`);
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as PlanRunSseEvent;

        // Fine-grained progress: append to the step's live text, nothing else.
        if (data.event === 'step_progress') {
          setStepProgress((prev) => ({ ...prev, [data.step_id]: appendChunk(prev[data.step_id] ?? '', data) }));
          return;
        }

        // Lifecycle snapshot: refresh the grid and clear live text for any step
        // that just reached a terminal status (its output now lives in the grid).
        setSteps(data.steps);
        setActiveStepIds(data.active_step_ids);
        setRunStatus(data.run_status);
        setStepProgress((prev) => clearFinished(prev, data.steps));
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

  return { steps, runStatus, activeStepIds, stepProgress, replicaId };
}
