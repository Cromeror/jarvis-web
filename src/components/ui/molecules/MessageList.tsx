import React, { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage } from '../../../lib/chat-api.js';
import { groupByAnsweredQuestion, countWaiting, type QueueState } from '../../../lib/chat-queue.js';
import { MessageBubble } from './MessageBubble.js';
import { QueuePanel, type QueuedMessageView } from './QueuePanel.js';
import { Spinner } from '../atoms/Spinner.js';
import { Icons } from '../atoms/Icons.js';

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
    <div
      className={`mx-auto flex min-h-full max-w-3xl flex-col space-y-6 px-6 py-6 ${isEmpty ? 'justify-center' : 'justify-end'}`}
    >
      {isEmpty && (
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--chatcontent-surface-subtle)] text-[var(--tab-text-hover)]">
            <Icons icon="Chat" style="Outline" size={20} />
          </div>
          <p className="text-sm text-[var(--chatcontent-text-muted)]">Escribí un mensaje para empezar la conversación.</p>
        </div>
      )}
      {groups.map((group) => (
        <div key={group.key} className="space-y-6">
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
                <p className="text-xs text-[var(--chatcontent-text-muted)]">
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
        </div>
      ))}
      {pending && (
        <div className="space-y-2">
          {liveText && <MessageBubble role="assistant" content={liveText} />}
          <div className="flex items-center gap-2 text-sm text-[var(--chatcontent-text-muted)]">
            <Spinner />
            Jarvis está pensando...
            {queuedCount > 0 && (
              // "esperando", no "en cola": el otro contador de la pantalla es el
              // de tareas en background, y las dos cosas se confunden leídas al
              // pasar.
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                {queuedCount} esperando
              </span>
            )}
            {onStop && (
              <button
                type="button"
                onClick={onStop}
                title="Detener el turno en curso"
                className="ml-2 rounded-full border border-[var(--chatcontent-border-subtle)] px-3 py-1 text-xs font-medium text-[var(--tab-text-hover)] hover:bg-white/10"
              >
                Detener
              </button>
            )}
          </div>
          {queuedCount > 0 && (
            <QueuePanel messages={queuedMessages} onRemove={onRemoveQueued} onClearAll={onClearQueue} />
          )}
        </div>
      )}
      {/*
        Fuera del bloque `pending` a propósito: una tarea en background sobrevive
        al turno que la lanzó, así que la barra tiene que seguir visible con el
        turno ya cerrado.
      */}
      {!pending && queuedCount > 0 && (
        <QueuePanel messages={queuedMessages} onRemove={onRemoveQueued} onClearAll={onClearQueue} />
      )}
      {proposedPlanIds?.map((planId) => (
        <button
          key={planId}
          type="button"
          onClick={() => onOpenPlan?.(planId)}
          className="flex w-full items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-left text-sm text-indigo-200 hover:bg-indigo-500/20"
        >
          <i className="pi pi-list-check text-sm" />
          Plan propuesto — ver en el panel
          <i className="pi pi-arrow-right ml-auto text-xs" />
        </button>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
