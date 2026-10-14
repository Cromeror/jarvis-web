import React from 'react';
import type { SessionOwnerMark } from '../../lib/session-owner.js';
import { Icon } from '../Icon.js';

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
// La variante de `.badge` decide fondo y tinta en los dos temas.
const TONE: Record<SessionOwnerMark['kind'], string> = {
  ajena: 'warning',
  huerfana: 'mute',
};

export function OwnerBadge({ mark, size = 'sm' }: OwnerBadgeProps): React.ReactElement | null {
  if (!mark) return null;
  const className = ['badge w-fit shrink-0', size === 'xs' ? 'text-[10px]' : 'text-[11px]'].join(' ');
  return (
    <span className={className} data-variant={TONE[mark.kind]} title={mark.detail}>
      <Icon name={mark.kind === 'ajena' ? 'users' : 'sliders'} />
      {mark.label}
    </span>
  );
}
