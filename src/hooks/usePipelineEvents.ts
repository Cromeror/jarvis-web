import { useEffect, useState } from 'react';

export interface PipelineStepEvent {
  id: number;
  run_id: string;
  step_index: number;
  step_id: string;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  stdout: string | null;
  stderr: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineRunSnapshot {
  id: string;
  project_id: string | null;
  name: string;
  yaml_path: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  finished_at: string | null;
}

interface StepUpdatedEvent {
  event: 'step_updated';
  step: PipelineStepEvent;
}

interface RunFinishedEvent {
  event: 'run_finished';
  status: 'completed' | 'failed' | 'cancelled';
}

type PipelineSseEvent = StepUpdatedEvent | RunFinishedEvent;

/**
 * Subscribes to real-time progress for a pipeline run via SSE
 * (GET /api/pipeline/:runId/events) — mirrors the EventSource pattern
 * used by Editor.tsx for /api/file/watch.
 */
export function usePipelineEvents(runId: string | null) {
  const [steps, setSteps] = useState<PipelineStepEvent[]>([]);
  const [runStatus, setRunStatus] = useState<'running' | 'completed' | 'failed' | 'cancelled'>('running');

  useEffect(() => {
    if (!runId) return;

    let cancelled = false;

    fetch(`/api/pipeline/${runId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { run: PipelineRunSnapshot; steps: PipelineStepEvent[] } | null) => {
        if (cancelled || !data) return;
        setSteps(data.steps);
        setRunStatus(data.run.status);
      })
      .catch(() => { /* snapshot best-effort — SSE will still fill in state */ });

    const es = new EventSource(`/api/pipeline/${runId}/events`);
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as PipelineSseEvent;
        if (data.event === 'step_updated') {
          setSteps((prev) => {
            const idx = prev.findIndex((s) => s.id === data.step.id);
            if (idx === -1) return [...prev, data.step].sort((a, b) => a.step_index - b.step_index);
            const next = [...prev];
            next[idx] = data.step;
            return next;
          });
        } else if (data.event === 'run_finished') {
          setRunStatus(data.status);
          es.close();
        }
      } catch { /* ignore malformed events */ }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [runId]);

  return { steps, runStatus };
}
