import React from 'react';
import { Icons } from '../atoms/Icons.js';
import { isRemovableFromQueue, type QueueState } from '../../../lib/chat-queue.js';

interface QueuedMessageRowProps {
  /** Posición en la cola, ya formateada ('1.º', '2.º'). */
  order: string;
  content: string;
  state: QueueState;
  /** Saca este mensaje de la cola. Solo se ofrece mientras no arrancó. */
  onRemove?: () => void;
}

const STATE_LABEL: Record<QueueState, string> = {
  sending: 'Enviando…',
  queued: 'En cola',
  started: 'Respondiendo',
};

/**
 * QueuedMessageRow — molécula "DBoard V1.1.X" de Figma (node 7746:1460),
 * variantes `Queued` / `Started` / `Cancelled`. Un mensaje del usuario dentro
 * del panel de cola.
 *
 * El `×` solo aparece en los que todavía no arrancaron, y eso no es una
 * decisión estética: `cancel_async_message` es no-op sobre un mensaje ya drenado
 * al turno ("No-op if already dequeued for execution"), así que ofrecerlo ahí
 * sería prometer algo que no pasa. Para ese está el stop del turno. La regla
 * vive en `isRemovableFromQueue` para que el botón no pueda desincronizarse de
 * lo que el CLI realmente acepta.
 */
export function QueuedMessageRow({ order, content, state, onRemove }: QueuedMessageRowProps): React.ReactElement {
  const removable = isRemovableFromQueue(state) && Boolean(onRemove);

  return (
    <div className="flex items-center gap-2.5 rounded-[10px] bg-white/4 px-2.5 py-2">
      <span className="shrink-0 text-[11px] font-semibold text-white/40">{order}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-white">{content}</span>
      <span className="shrink-0 text-[10px] text-white/50">{STATE_LABEL[state]}</span>
      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar de la cola: ${content}`}
          title="Quitar de la cola"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/70 hover:bg-white/15 hover:text-white"
        >
          <Icons icon="x-circle" size={12} />
        </button>
      ) : (
        // Hueco del mismo tamaño: mantiene alineado el borde derecho de todas
        // las filas, con y sin botón.
        <span className="h-5 w-5 shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}
