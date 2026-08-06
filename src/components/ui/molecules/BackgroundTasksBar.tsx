import React, { useState } from 'react';
import { Icons } from '../atoms/Icons.js';
import { Badge } from '../atoms/Badge.js';
import { BackgroundTaskRow, type BackgroundTaskState } from './BackgroundTaskRow.js';
import type { BackgroundTaskLike } from '../../../lib/chat-queue.js';

/** Una tarea lista para renderizar: lo que manda el CLI más lo que la fila muestra. */
export interface BackgroundTaskView extends BackgroundTaskLike {
  state?: BackgroundTaskState;
  elapsed?: string;
  note?: string;
}

interface BackgroundTasksBarProps {
  tasks: BackgroundTaskView[];
  /** Detiene una tarea puntual (`stop_task` con su task_id). */
  onStopTask?: (taskId: string) => void;
  /**
   * Detiene todo lo que sigue vivo. NO es el stop del turno: ese manda
   * `interrupt` + `cancel_queued` y no toca estas tareas. Como `stop_task` en el
   * CLI es siempre por `task_id`, esto termina siendo N llamadas, una por tarea.
   */
  onStopAll?: () => void;
}

/**
 * BackgroundTasksBar — molécula "DBoard V1.1.X" de Figma (node 7733:1433),
 * variantes `Collapsed` / `Expanded` / `Empty`.
 *
 * Barra fija al pie de la lista de mensajes que resume las tareas vivas que
 * reporta `system/background_tasks_changed`. Vive FUERA del historial porque una
 * tarea sobrevive al turno que la lanzó — verificado contra el CLI real 2.1.220:
 * el `result` llega antes del `task_notification`. Si fuera una fila del
 * historial, se scrollearía fuera de vista con trabajo todavía corriendo.
 *
 * Colapsada por default: mientras Jarvis responde, la cola de tareas no debería
 * competir por la atención con la respuesta.
 */
export function BackgroundTasksBar({ tasks, onStopTask, onStopAll }: BackgroundTasksBarProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);

  // Sin tareas la barra no existe. La variante Empty del Figma quedó como
  // referencia del estado vacío, no como algo que se renderice.
  if (tasks.length === 0) return null;

  const running = tasks.filter((t) => (t.state ?? 'running') === 'running').length;
  const label = `${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'} en background`;

  return (
    <div className="border-t border-white/8 bg-[var(--chatcontent-bg-base,#212121)] px-4 py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Icons icon="clock" size={14} className="shrink-0 opacity-90" />
          <span className="truncate text-xs font-semibold text-white">{label}</span>
          {running > 0 && <Badge label="Running" status="running" size="xs" />}
        </button>
        {onStopAll && (
          <button
            type="button"
            onClick={onStopAll}
            title="Detener las tareas en background"
            className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
          >
            Detener
          </button>
        )}
        <Icons
          icon="chevron-right"
          size={14}
          className={`shrink-0 opacity-50 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {expanded && (
        // Techo de alto con scroll propio: con muchas tareas el panel comería
        // toda la conversación. `max-h` en vez de alto fijo para que con dos o
        // tres tareas ocupe solo lo que necesita.
        <div className="mt-1 max-h-[40vh] space-y-0.5 overflow-y-auto pl-1.5">
          {tasks.map((task) => (
            <BackgroundTaskRow
              key={task.task_id}
              description={task.description}
              taskType={task.task_type}
              state={task.state}
              elapsed={task.elapsed}
              note={task.note}
              onStop={
                onStopTask && (task.state ?? 'running') === 'running'
                  ? () => onStopTask(task.task_id)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
