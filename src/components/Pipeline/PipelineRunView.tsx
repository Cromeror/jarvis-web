import React from 'react';
import { useParams } from 'react-router-dom';
import { usePipelineEvents } from '../../hooks/usePipelineEvents.js';

const STATUS_LABEL: Record<string, string> = {
  pending: '○ pendiente',
  running: '● corriendo',
  completed: '✔ completado',
  failed: '✘ falló',
};

export function PipelineRunView(): React.ReactElement {
  const { runId } = useParams<{ runId: string }>();
  const { steps, runStatus } = usePipelineEvents(runId ?? null);

  return (
    <div className="pipeline-run-view">
      <h1>Pipeline run {runId}</h1>
      <p>Estado: {STATUS_LABEL[runStatus] ?? runStatus}</p>

      <ol className="pipeline-run-steps">
        {steps.map((step) => (
          <li key={step.id}>
            <strong>{step.step_id}</strong> — {STATUS_LABEL[step.status] ?? step.status}
            <div><code>{step.command}</code></div>
            {step.exit_code !== null && <div>exit code: {step.exit_code}</div>}
            {step.stderr && <pre>{step.stderr}</pre>}
          </li>
        ))}
      </ol>
    </div>
  );
}
