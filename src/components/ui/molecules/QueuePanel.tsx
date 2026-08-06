import React, { useState } from 'react';
import { Icons } from '../atoms/Icons.js';
import { QueuedMessageRow } from './QueuedMessageRow.js';
import type { QueueState } from '../../../lib/chat-queue.js';

/** Un mensaje de la cola listo para listar. */
export interface QueuedMessageView {
  /** Id de la fila del historial — para la key de React y para el callback. */
  id: number;
  /** El uuid con el que se encoló en el CLI. Ausente mientras el POST no respondió. */
  commandUuid?: string | null;
  content: string;
  state: QueueState;
}

interface QueuePanelProps {
  messages: QueuedMessageView[];
  /** Saca un mensaje de la cola (`cancel_async_message` con su uuid). */
  onRemove?: (message: QueuedMessageView) => void;
  /**
   * Vacía la cola entera. Ojo: mapea a `interrupt` + `cancel_queued`, que además
   * ABORTA el turno en curso — no es "el × para todos". Por eso pide confirmar.
   */
  onClearAll?: () => void;
}

/**
 * QueuePanel — molécula "DBoard V1.1.X" de Figma (node 7747:1483), variantes
 * `Collapsed` / `Expanded`. Cuelga del pill de la ThinkingRow.
 *
 * Lista la cola COMPLETA, incluido el mensaje que se está contestando, aunque el
 * pill de afuera solo cuente los que esperan. No es una inconsistencia: para
 * decidir qué sacar hay que ver cuál ya es tarde.
 *
 * Colapsado por default — mientras Jarvis responde, la cola no debería tapar la
 * respuesta.
 */
export function QueuePanel({ messages, onRemove, onClearAll }: QueuePanelProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  if (messages.length === 0) return null;

  const removable = messages.some((m) => m.state !== 'started');

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-3 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-xs font-semibold text-white/90">
            {messages.length} {messages.length === 1 ? 'mensaje' : 'mensajes'} en cola
          </span>
          {removable && (
            <span className="truncate text-[11px] text-white/45">podés quitar los que no empezaron</span>
          )}
        </button>

        {onClearAll && removable && (
          confirmingClear ? (
            <span className="flex shrink-0 items-center gap-2 text-[11px]">
              {/* Se avisa lo que hace de verdad: barre la cola Y corta el turno. */}
              <span className="text-white/60">¿Vaciar y detener el turno?</span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmingClear(false);
                }}
                className="font-semibold text-white hover:underline"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="text-white/60 hover:underline"
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="shrink-0 text-[11px] font-semibold text-white/70 hover:text-white"
            >
              Vaciar la cola
            </button>
          )
        )}

        <Icons
          icon="chevron-right"
          size={14}
          className={`shrink-0 opacity-50 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </div>

      {expanded && (
        <div className="mt-2 space-y-1">
          {messages.map((message, i) => (
            <QueuedMessageRow
              key={message.id}
              order={`${i + 1}.º`}
              content={message.content}
              state={message.state}
              onRemove={onRemove ? () => onRemove(message) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
