import React, { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage } from '../../../lib/chat-api.js';
import { groupByAnsweredQuestion, countWaiting, type QueueState } from '../../../lib/chat-queue.js';
import { MessageBubble } from './MessageBubble.js';
import { QueuePanel, type QueuedMessageView } from './QueuePanel.js';
import { Markdown } from '../atoms/Markdown.js';
import { Icon } from '../../Icon.js';

interface MessageListProps {
  /**
   * Sesión dueña de `messages` — sirve para distinguir "entré/cambié de
   * conversación" (debe quedar asentado en el fondo sin animación) de "llegó
   * un mensaje nuevo en la conversación que ya estoy mirando" (ahí sí tiene
   * sentido el scroll suave). Sin esto no hay forma de saber por qué cambió
   * `messages.length`: el componente no se remonta al cambiar de sesión.
   */
  sessionId?: string | null;
  messages: ChatMessage[];
  pending: boolean;
  /** Partial assistant text streamed so far for the turn in flight — empty when there's nothing to show yet (e.g. Jarvis is still only running tools). */
  liveText?: string;
  /** Cancela el turno en curso. Ausente mientras no hay nada que detener. */
  onStop?: () => void;
  /**
   * Estado de cola por id de mensaje del usuario ('queued' | 'started'). Los
   * mensajes encolados ya están en el historial (se persisten al enviarlos),
   * así que no se re-renderizan: se les marca el estado sobre su propia
   * burbuja, que es lo que deja ver qué está contestando Jarvis cuando un
   * turno responde a varios mensajes a la vez.
   */
  queueStates?: Map<number, QueueState>;
  /** Saca un mensaje puntual de la cola (`cancel_async_message`). */
  onRemoveQueued?: (message: QueuedMessageView) => void;
  /** Vacía la cola entera — `interrupt` + `cancel_queued`, que también corta el turno. */
  onClearQueue?: () => void;
  proposedPlanIds?: string[];
  onOpenPlan?: (planId: string) => void;
}

/**
 * MessageList — molécula "DBoard V1.1.X" de Figma (node 7662:36531).
 *
 * Las variantes del Figma NO son componentes separados acá: la misma lista
 * ramifica por datos. Empty (ícono + texto centrados) vs. Messages es
 * `justify-center`/`justify-end`, para que unos pocos mensajes queden pegados
 * abajo en vez de flotar en el medio. Grouped sale de `groupByAnsweredQuestion`.
 * Y Processing / Queued / BackgroundActive **coexisten** en producción — un
 * turno abierto puede tener mensajes en cola y tareas vivas al mismo tiempo;
 * en Figma son variantes hermanas solo porque `State` es un enum.
 */
export function MessageList({
  sessionId,
  messages,
  pending,
  liveText,
  onStop,
  queueStates,
  onRemoveQueued,
  onClearQueue,
  proposedPlanIds,
  onOpenPlan,
}: MessageListProps): React.ReactElement {
  const queuedCount = queueStates ? countWaiting(queueStates) : 0;
  const groups = useMemo(() => groupByAnsweredQuestion(messages), [messages]);

  // La cola que lista el panel: TODO lo que tiene estado, incluido el que se
  // está contestando. El pill de arriba cuenta solo los que esperan, y esa
  // diferencia es a propósito — para decidir qué sacar hay que ver cuál ya
  // arrancó.
  const queuedMessages = useMemo<QueuedMessageView[]>(() => {
    if (!queueStates || queueStates.size === 0) return [];
    return messages
      .filter((m) => queueStates.has(m.id))
      .map((m) => ({
        id: m.id,
        commandUuid: m.command_uuid,
        content: m.content,
        state: queueStates.get(m.id)!,
      }));
  }, [messages, queueStates]);
  const isEmpty = messages.length === 0 && !pending;
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSessionIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const sessionChanged = lastSessionIdRef.current !== sessionId;
    lastSessionIdRef.current = sessionId;
    bottomRef.current?.scrollIntoView({ behavior: sessionChanged ? 'auto' : 'smooth' });
  }, [messages.length, pending, sessionId]);

  return (
    /* EL CARRIL DEL HILO. `.sw-chat__msgs` no es un contenedor cualquiera: su
       `padding-left: var(--sw-hilo-w)` es el lugar donde cada `.sw-msg` dibuja
       su nodo y su tramo de línea, que van en negativo. Sin él los nodos caen
       fuera de la caja y el hilo no se ve.

       Acá no hay `space-y`: el hueco entre turnos lo pone el `gap` del carril,
       y tiene que ser el mismo con el que `.sw-msg::after` calcula hasta dónde
       baja su tramo de línea. Dos fuentes para esa medida = la línea cortada
       antes del nodo siguiente. */
    <div className="sw-chat__msgs">
      {isEmpty && <p className="sw-msg__metricas">Escribí un mensaje para empezar la conversación.</p>}
      {groups.map((group) => (
        <React.Fragment key={group.key}>
          {group.questions.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              attachments={m.attachments}
              queueState={queueStates?.get(m.id)}
            />
          ))}
          {group.answer && (
            <>
              {group.questions.length > 1 && (
                <p className="sw-msg__metricas">
                  Una sola respuesta para esos {group.questions.length} mensajes
                </p>
              )}
              <MessageBubble
                key={group.answer.id}
                role={group.answer.role}
                content={group.answer.content}
                inputTokens={group.answer.input_tokens}
                outputTokens={group.answer.output_tokens}
                contextUsedPercent={group.answer.context_used_percent}
                durationMs={group.answer.duration_ms}
                attachments={group.answer.attachments}
              />
            </>
          )}
        </React.Fragment>
      ))}

      {pending && (
        /* LA FILA DE «PENSANDO» ES UN TURNO MÁS DEL HILO (`.sw-msg--pensando`
           en el template), no un aviso suelto al pie: aparece donde va a
           aparecer la respuesta, así que el ojo ya está mirando el lugar
           correcto cuando el texto empieza a llegar. */
        <div className="sw-msg sw-msg--ai">
          <div className="sw-msg__who">
            <Icon name="audioLines" />
            <span className="sw-msg__nombre">Jarvis</span>
            {queuedCount > 0 && (
              // "esperando", no "en cola": el otro contador de la pantalla es
              // el de tareas en background, y las dos cosas se confunden
              // leídas al pasar.
              <span>{queuedCount} esperando</span>
            )}
            {onStop && (
              <button type="button" className="sw-msg__tool" onClick={onStop} aria-label="Detener el turno en curso" title="Detener el turno en curso">
                <Icon name="stop" />
              </button>
            )}
          </div>
          <div className="sw-msg__body">
            {liveText ? (
              <Markdown prosa={false}>{liveText}</Markdown>
            ) : (
              <span role="status">Pensando…</span>
            )}
          </div>
        </div>
      )}

      {queuedCount > 0 && (
        /* Fuera del bloque `pending` a propósito: una tarea en background
           sobrevive al turno que la lanzó, así que el panel tiene que seguir
           visible con el turno ya cerrado. */
        <QueuePanel messages={queuedMessages} onRemove={onRemoveQueued} onClearAll={onClearQueue} />
      )}

      {proposedPlanIds?.map((planId) => (
        <button key={planId} type="button" className="sw-msg__act" onClick={() => onOpenPlan?.(planId)}>
          <Icon name="check" />
          <span>Plan propuesto — ver en el panel</span>
        </button>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
