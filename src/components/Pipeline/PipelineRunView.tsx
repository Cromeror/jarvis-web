import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePipelineEvents } from '../../hooks/usePipelineEvents.js';
import { stopPipelineRun } from '../../lib/pipelines-api.js';

const STATUS_LABEL: Record<string, string> = {
  pending: '○ pendiente',
  running: '● corriendo',
  completed: '✔ completado',
  failed: '✘ falló',
  cancelled: '⏹ detenido',
};

export function PipelineRunView(): React.ReactElement {
  const { runId } = useParams<{ runId: string }>();
  const { steps, runStatus } = usePipelineEvents(runId ?? null);
  const [stopping, setStopping] = useState(false);

  const handleStop = (): void => {
    if (!runId) return;
    setStopping(true);
    stopPipelineRun(runId).finally(() => setStopping(false));
  };

  return (
    <div className="pipeline-run-view">
      <h1>Pipeline run {runId}</h1>
      <p>
        Estado: {STATUS_LABEL[runStatus] ?? runStatus}
        {runStatus === 'running' && (
          <button type="button" onClick={handleStop} disabled={stopping} style={{ marginLeft: '0.75rem' }}>
            {stopping ? 'Deteniendo…' : 'Detener'}
          </button>
        )}
      </p>

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
