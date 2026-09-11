import React from 'react';
import type { SessionOwnerMark } from '../../lib/session-owner.js';

interface OwnerBadgeProps {
  /** `null` = no hay nada que marcar (es tuya, o el server no lo dice). No renderiza. */
  mark: SessionOwnerMark | null;
  size?: 'sm' | 'xs';
}

/**
 * De quién es la conversación, cuando no es tuya.
 *
 * Al revés que `WorkspaceBadge`, acá sólo se pinta la EXCEPCIÓN: "sin badge"
 * no es ambiguo porque el caso normal —tus propias conversaciones— es el 100%
 * de lo que ve casi todo el mundo. Marcar cada fila con "tuya" gastaría la
 * señal justo donde importa.
 *
 * Tono ámbar y no rojo a propósito: ver lo ajeno acá no es un error ni una
 * fuga, es un permiso que se tiene. Lo que hace falta es no confundirlo con lo
 * propio.
 */
const TONE: Record<SessionOwnerMark['kind'], string> = {
  ajena: 'bg-amber-100 text-amber-800',
  huerfana: 'bg-slate-100 text-slate-600',
};

export function OwnerBadge({ mark, size = 'sm' }: OwnerBadgeProps): React.ReactElement | null {
  if (!mark) return null;
  const className = [
    'inline-flex w-fit shrink-0 items-center gap-1 rounded-full font-semibold',
    size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
    TONE[mark.kind],
  ].join(' ');
  return (
    <span className={className} title={mark.detail}>
      <i className={`pi ${mark.kind === 'ajena' ? 'pi-user' : 'pi-cog'} text-[9px]`} />
      {mark.label}
    </span>
  );
}
