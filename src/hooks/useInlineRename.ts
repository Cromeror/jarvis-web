import { useCallback, useState } from 'react';

export interface InlineRename {
  /** Id que se está editando, o null. Quien renderiza compara contra el suyo. */
  editingId: string | null;
  draft: string;
  setDraft: (value: string) => void;
  /** Entra en edición con el título actual como borrador (null/'' arranca vacío). */
  start: (id: string, currentTitle: string | null) => void;
  /** Sale de edición y renombra sólo si el valor cambió y no quedó vacío. */
  commit: () => void;
  cancel: () => void;
}

/**
 * Edición in-place de un título de conversación. Existe como hook y no dentro
 * de un componente porque hay DOS entradas al mismo rename (el título del
 * header y el lápiz del ConversationSwitcher) y las reglas tienen que ser las
 * mismas en las dos: Enter/blur confirma, Escape descarta, y el commit se
 * traga los no-cambios.
 *
 * Un borrador vacío NO borra el título: el backend rechaza `title` vacío con
 * 400, así que mandarlo sería un error visible por un gesto que en cualquier
 * editor inline significa "no quise cambiar nada". Se descarta como un Escape.
 */
export function useInlineRename(onRename: (id: string, title: string) => void): InlineRename {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [original, setOriginal] = useState<string | null>(null);

  const start = useCallback((id: string, currentTitle: string | null) => {
    setEditingId(id);
    setDraft(currentTitle ?? '');
    setOriginal(currentTitle ?? '');
  }, []);

  const cancel = useCallback(() => setEditingId(null), []);

  const commit = useCallback(() => {
    const id = editingId;
    const trimmed = draft.trim();
    setEditingId(null);
    if (!id || !trimmed || trimmed === (original ?? '')) return;
    onRename(id, trimmed);
  }, [editingId, draft, original, onRename]);

  return { editingId, draft, setDraft, start, commit, cancel };
}
