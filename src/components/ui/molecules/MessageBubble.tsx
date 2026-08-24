import React from 'react';
import { Avatar } from '../atoms/Avatar.js';
import { Markdown } from '../atoms/Markdown.js';
import { Spinner } from '../atoms/Spinner.js';

interface MessageBubbleProps {
  role: string;
  content: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  contextUsedPercent?: number | null;
  durationMs?: number | null;
  attachments?: string | null;
  /**
   * Estado de un mensaje del usuario que Jarvis todavía no contestó:
   * 'sending' = local, apenas se apretó enviar y el server todavía no
   * confirmó; 'queued' = ya está en la cola del CLI esperando su turno;
   * 'started' = lo está respondiendo ahora. Ausente cuando ya fue contestado
   * (que es el caso de todo el historial).
   */
  queueState?: 'sending' | 'queued' | 'started';
}

/** Parses the JSON `attachments` column into filenames, fail-soft on malformed/missing data. */
function parseAttachmentNames(attachments?: string | null): string[] {
  if (!attachments) return [];
  try {
    const parsed = JSON.parse(attachments) as Array<{ filename?: string }>;
    return parsed.map((a) => a.filename).filter((f): f is string => Boolean(f));
  } catch {
    return [];
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

export function MessageBubble({
  role,
  content,
  inputTokens,
  outputTokens,
  contextUsedPercent,
  durationMs,
  attachments,
  queueState,
}: MessageBubbleProps): React.ReactElement {
  const isUser = role === 'user';

  if (isUser) {
    const attachmentNames = parseAttachmentNames(attachments);
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-[var(--sidebar2-accent-default)] px-4 py-2.5 text-[17px] leading-relaxed text-white md:text-sm md:leading-normal">
          {queueState === 'sending' && <div className="mb-1 text-xs text-white/70">Enviando…</div>}
          {queueState === 'queued' && <div className="mb-1 text-xs text-white/70">En cola</div>}
          {queueState === 'started' && <div className="mb-1 flex items-center gap-1.5 text-xs text-white/70"><Spinner />Respondiendo…</div>}
          {attachmentNames.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {attachmentNames.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs text-white/90"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
          {content}
        </div>
      </div>
    );
  }

  const hasTokens = inputTokens != null || outputTokens != null;
  const hasContextPercent = contextUsedPercent != null;
  const hasDuration = durationMs != null;

  return (
    <div className="flex gap-3">
      <Avatar role="assistant" />
      <div className="min-w-0 max-w-[85%] flex-1 text-[17px] leading-relaxed text-[var(--messagelist-text-assistant)] md:text-sm md:leading-relaxed">
        <Markdown>{content}</Markdown>
        {(hasTokens || hasContextPercent || hasDuration) && (
          <div className="mt-1 flex items-center justify-between text-xs text-[var(--messagelist-text-meta)]">
            <span>
              {hasTokens && (
                <>
                  {inputTokens ?? 0} in · {outputTokens ?? 0} out
                </>
              )}
              {hasContextPercent && (
                <>{hasTokens ? ' · ' : ''}{contextUsedPercent}% de contexto usado</>
              )}
            </span>
            {hasDuration && <span>{formatDuration(durationMs!)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
