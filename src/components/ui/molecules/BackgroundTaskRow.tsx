import React from 'react';
import { Icons, type IconName } from '../atoms/Icons.js';

/**
 * Estado de una tarea en background, mapeado a lo que reporta el CLI:
 * `running`/`pending` mientras vive (filtro propio del CLI: `status ∈
 * {running, pending}` y `isBackgrounded !== false`), y el terminal que informa
 * `task_notification` — `completed` → done, `error`/`preSpawnError` → failed,
 * `stopped`/`interrupted` → stopped.
 */
export type BackgroundTaskState = 'running' | 'done' | 'failed' | 'stopped';

interface BackgroundTaskRowProps {
  description: string;
  /** `local_bash`, `local_agent`, `local_workflow`, `monitor_mcp`… — lo define el CLI, no nosotros. */
  taskType?: string;
  state?: BackgroundTaskState;
  /** Cuánto lleva corriendo, ya formateado ('12s', '2m'). */
  elapsed?: string;
  /** Nota extra a la derecha: 'salida guardada', 'falló'. */
  note?: string;
  /** Detiene esta tarea (`stop_task` con su task_id). Ausente cuando ya terminó. */
  onStop?: () => void;
}

const STATE_ICON: Record<BackgroundTaskState, IconName> = {
  running: 'clock',
  done: 'check-circle',
  failed: 'x-circle',
  stopped: 'warning',
};

/** Una terminada se atenúa: sigue informando, pero ya no pide atención. */
const STATE_TEXT_CLASS: Record<BackgroundTaskState, string> = {
  running: 'text-[var(--chatcontent-text-primary,#fff)]',
  done: 'text-white/70',
  failed: 'text-white/70',
  stopped: 'text-white/70',
};

/**
 * BackgroundTaskRow — molécula "DBoard V1.1.X" de Figma (node 7732:1403), 4
 * variantes de `State`. Una tarea que Jarvis dejó corriendo, dentro de
 * `BackgroundTasksBar`.
 *
 * El `taskType` se muestra crudo, como lo manda el CLI, porque distingue dos
 * cosas que conviene no confundir: un proceso dejado corriendo (`local_bash`,
 * `monitor_*`) de un subagente o workflow del propio modelo (`local_agent`,
 * `local_workflow`).
 */
export function BackgroundTaskRow({
  description,
  taskType,
  state = 'running',
  elapsed,
  note,
  onStop,
}: BackgroundTaskRowProps): React.ReactElement {
  const meta = [taskType, elapsed, note].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 hover:bg-white/5">
      <Icons icon={STATE_ICON[state]} size={14} className="shrink-0 opacity-90" />
      <span className={`min-w-0 flex-1 truncate text-xs ${STATE_TEXT_CLASS[state]}`}>{description}</span>
      {meta && <span className="shrink-0 text-[11px] text-white/50">{meta}</span>}
      {onStop && (
        <button
          type="button"
          onClick={onStop}
          aria-label={`Detener ${description}`}
          title="Detener esta tarea"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/70 hover:bg-white/15 hover:text-white"
        >
          <Icons icon="x-circle" size={12} />
        </button>
      )}
    </div>
  );
}
