import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../../lib/chat-api.js';
import { MessageBubble } from './MessageBubble.js';
import { Spinner } from '../atoms/Spinner.js';
import { Icons } from '../atoms/Icons.js';

interface MessageListProps {
  messages: ChatMessage[];
  pending: boolean;
  /** Partial assistant text streamed so far for the turn in flight — empty when there's nothing to show yet (e.g. Jarvis is still only running tools). */
  liveText?: string;
  /** Cancela el turno en curso. Ausente mientras no hay nada que detener. */
  onStop?: () => void;
  proposedPlanIds?: string[];
  onOpenPlan?: (planId: string) => void;
}

/**
 * MessageList — molécula "DBoard V1.1.X" de Figma (node 7662:36531), 2
 * variantes: Empty (ícono + texto centrados verticalmente) / Messages
 * (anclados abajo, cerca del input). En código no son variantes separadas —
 * la misma lista decide sola según si hay mensajes: `justify-center` vacía,
 * `justify-end` con contenido, para que unos pocos mensajes queden pegados
 * abajo en vez de flotar en el medio.
 */
export function MessageList({ messages, pending, liveText, onStop, proposedPlanIds, onOpenPlan }: MessageListProps): React.ReactElement {
  const isEmpty = messages.length === 0 && !pending;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending]);

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
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          role={m.role}
          content={m.content}
          inputTokens={m.input_tokens}
          outputTokens={m.output_tokens}
          contextUsedPercent={m.context_used_percent}
          durationMs={m.duration_ms}
          attachments={m.attachments}
        />
      ))}
      {pending && (
        <div className="space-y-2">
          {liveText && <MessageBubble role="assistant" content={liveText} />}
          <div className="flex items-center gap-2 text-sm text-[var(--chatcontent-text-muted)]">
            <Spinner />
            Jarvis está pensando...
            {onStop && (
              <button
                type="button"
                onClick={onStop}
                className="ml-2 rounded-full border border-[var(--chatcontent-border-subtle)] px-3 py-1 text-xs font-medium text-[var(--tab-text-hover)] hover:bg-white/10"
              >
                Detener
              </button>
            )}
          </div>
        </div>
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
