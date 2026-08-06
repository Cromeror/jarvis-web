import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Avatar } from '../atoms/Avatar.js';
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

function CodeBlock({ children }: { children: React.ReactNode }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const text = String(children).replace(/\n$/, '');

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl bg-slate-900">
      <div className="flex items-center justify-between px-4 py-1.5">
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pb-3 text-sm text-slate-100">
        <code>{text}</code>
      </pre>
    </div>
  );
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
        <div className="max-w-[75%] rounded-2xl bg-[var(--sidebar2-accent-default)] px-4 py-2.5 text-[17px] leading-relaxed text-white md:text-sm md:leading-normal">
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
      <div className="min-w-0 max-w-[85%] flex-1 text-[17px] leading-relaxed text-[var(--messagelist-text-assistant)] md:text-sm md:leading-relaxed [&_a]:text-[var(--sidebar2-accent-default)] [&_a]:underline [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_hr]:my-3 [&_hr]:border-[var(--chatcontent-border-subtle)] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const isBlock = /language-/.test(className ?? '') || String(children).includes('\n');
              if (isBlock) return <CodeBlock>{children}</CodeBlock>;
              return (
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-[var(--messagelist-text-assistant)]" {...props}>
                  {children}
                </code>
              );
            },
            pre({ children }) {
              return <>{children}</>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
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
