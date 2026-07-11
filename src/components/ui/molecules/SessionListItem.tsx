import React from 'react';
import type { ChatSession } from '../../../lib/chat-api.js';

interface SessionListItemProps {
  session: ChatSession;
  active: boolean;
  pending: boolean;
  unread: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function SessionListItem({
  session,
  active,
  pending,
  unread,
  onClick,
  onDelete,
}: SessionListItemProps): React.ReactElement {
  return (
    <div
      className={`group relative flex w-full items-center overflow-hidden rounded-lg text-sm transition-colors ${
        active
          ? 'bg-white font-medium text-indigo-700 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-600 hover:bg-white/70'
      }`}
    >
      {pending && (
        <span
          aria-label="Procesando"
          className="absolute inset-y-0 left-0 w-0.5 overflow-hidden rounded-full bg-indigo-100"
        >
          <span className="absolute inset-x-0 h-1/3 animate-session-pending rounded-full bg-indigo-500" />
        </span>
      )}
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left">
        <span className="min-w-0 flex-1 truncate">{session.title ?? 'Nueva conversación'}</span>
        {unread && !pending && (
          <span
            aria-label="Mensaje nuevo sin leer"
            title="Mensaje nuevo sin leer"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600"
          />
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Eliminar conversación"
        title="Eliminar conversación"
        className="mr-1 shrink-0 rounded px-2 py-1 text-slate-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
