import React from 'react';
import type { ChatSession } from '../../lib/chat-api.js';
import { sessionOwnerMark } from '../../lib/session-owner.js';
import { OwnerBadge } from './OwnerBadge.js';
import { useInlineRename } from '../../hooks/useInlineRename.js';

interface ConversationTitleProps {
  session: ChatSession | null;
  onRename: (sessionId: string, title: string) => void;
}

/**
 * El nombre de la conversación abierta, editable con un click.
 *
 * Es el acceso PRINCIPAL al rename. Antes el único era el lápiz de una fila del
 * ConversationSwitcher, que sólo aparece al hover dentro de un popover cuyo
 * trigger dice "Buscar conversación": la capacidad existía end-to-end y no
 * había forma razonable de encontrarla. Peor, el header no mostraba el título
 * en ningún lado, así que uno no veía ni el nombre que iba a cambiar.
 *
 * Sin conversación abierta no renderiza: un título editable de la nada no tiene
 * a quién renombrar.
 *
 * Cuando la conversación es de otra persona lo dice acá, al lado del nombre:
 * es el único punto de la pantalla que está presente mientras la LEÉS. El badge
 * del historial o del buscador se ve un segundo y desaparece al entrar.
 */
export function ConversationTitle({ session, onRename }: ConversationTitleProps): React.ReactElement | null {
  const rename = useInlineRename(onRename);

  if (!session) return null;

  const editing = rename.editingId === session.id;
  const label = session.title ?? 'Nueva conversación';
  const owner = sessionOwnerMark(session);

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={rename.draft}
        onChange={(e) => rename.setDraft(e.target.value)}
        onBlur={rename.commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            rename.commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            rename.cancel();
          }
        }}
        aria-label="Nombre de la conversación"
        className="min-w-0 max-w-[18rem] flex-1 rounded-md border border-indigo-300 bg-white/95 px-2 py-1 text-sm text-slate-700 outline-none"
      />
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => rename.start(session.id, session.title)}
        title="Renombrar conversación"
        className="group flex min-w-0 max-w-[18rem] items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-white/10"
      >
        <span
          className={`min-w-0 truncate text-sm ${session.title ? 'text-[var(--tab-text-hover)]' : 'italic text-[var(--tab-text-default)]'}`}
        >
          {label}
        </span>
        <i className="pi pi-pencil shrink-0 text-[10px] text-[var(--tab-text-default)] opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      {/* Fuera del botón: es información, no un disparador del rename. */}
      <OwnerBadge mark={owner} size="xs" />
    </span>
  );
}
