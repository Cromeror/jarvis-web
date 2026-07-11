import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../lib/chat-api.js';
import { MessageBubble } from '../ui/molecules/MessageBubble.js';
import { ChatInputBar } from '../ui/molecules/ChatInputBar.js';
import { Spinner } from '../ui/atoms/Spinner.js';

interface ChatWindowProps {
  messages: ChatMessage[];
  pending: boolean;
  onSend: (message: string, attachments?: File[]) => void;
}

export function ChatWindow({ messages, pending, onSend }: ChatWindowProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pending]);

  return (
    <div className="flex h-full flex-1 flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
          {messages.length === 0 && !pending && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-24 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M21 11.5c0 4.14-4.03 7.5-9 7.5-1.06 0-2.07-.15-3-.42L4 20l1.1-3.3C3.8 15.4 3 13.53 3 11.5 3 7.36 7.03 4 12 4s9 3.36 9 7.5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-400">Escribí un mensaje para empezar la conversación.</p>
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
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Spinner />
              Jarvis está pensando...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <ChatInputBar disabled={pending} onSend={onSend} />
    </div>
  );
}
