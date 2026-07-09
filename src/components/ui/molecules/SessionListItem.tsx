import React from 'react';
import type { ChatSession } from '../../../lib/chat-api.js';

interface SessionListItemProps {
  session: ChatSession;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function SessionListItem({ session, active, onClick, onDelete }: SessionListItemProps): React.ReactElement {
  return (
    <div
      className={`group flex w-full items-center rounded-lg text-sm transition-colors ${
        active
          ? 'bg-white font-medium text-indigo-700 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-600 hover:bg-white/70'
      }`}
    >
      <button type="button" onClick={onClick} className="min-w-0 flex-1 truncate px-3 py-2 text-left">
        {session.title ?? 'Nueva conversación'}
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
