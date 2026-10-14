import type { PlanStatus } from '../../lib/plans-api.js';

/**
 * El estado de un plan, en palabras y en color: lo usan la lista y el modal.
 *
 * Estaba escrito dos veces —la etiqueta en cada archivo, y el color en la
 * lista con los tonos de un `StatusBadge` de paleta fija y en el modal con un
 * índigo para todos—, así que el mismo estado se veía distinto según dónde se
 * mirara. El color es la `data-variant` del `.badge` de Basecoat (el tema la
 * resuelve con los tokens de estado); `undefined` es el badge neutro.
 */
export const ETIQUETA_DE_ESTADO: Record<PlanStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  running: 'Ejecutando',
  done: 'Completado',
  failed: 'Falló',
  archived: 'Archivado',
};

export const VARIANTE_DE_ESTADO: Record<PlanStatus, string | undefined> = {
  draft: 'mute',
  approved: 'attention',
  running: 'warning',
  done: 'success',
  failed: 'error',
  archived: 'mute',
};
