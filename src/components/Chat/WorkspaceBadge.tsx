import React from 'react';
import type { SessionWorkspace } from '../../lib/session-workspace.js';
import { Icon } from '../Icon.js';

interface WorkspaceBadgeProps {
  workspace: SessionWorkspace;
  /** Con onClick es el disparador de "trabajar en otra réplica"; sin él, solo informa. */
  onClick?: () => void;
  size?: 'sm' | 'xs';
}

/**
 * En qué workspace corre una conversación, en un badge.
 *
 * La base también se muestra, no solo las réplicas: si únicamente se pintara
 * la excepción, "sin badge" sería ambiguo entre "corre en la base" y "esta
 * vista todavía no sabe". El dato importa justamente para comparar dos
 * conversaciones entre sí.
 */
// La variante de `.badge` decide fondo y tinta en los dos temas; la réplica va
// sin variante (el `.badge` de base, con el acento) porque es la que hay que
// notar: la base es el caso de todos los días.
const TONE: Record<SessionWorkspace['kind'], string | undefined> = {
  base: 'mute',
  replica: undefined,
  unknown: 'error',
};

export function WorkspaceBadge({ workspace, onClick, size = 'sm' }: WorkspaceBadgeProps): React.ReactElement {
  const className = [
    'badge w-fit shrink-0',
    size === 'xs' ? 'text-[10px]' : 'text-[11px]',
    onClick ? 'cursor-pointer hover:brightness-95' : '',
  ].join(' ');

  const content = (
    <>
      <Icon name={workspace.kind === 'unknown' ? 'alerta' : 'folder'} />
      {workspace.label}
    </>
  );

  if (!onClick) {
    return (
      <span className={className} data-variant={TONE[workspace.kind]} title={workspace.detail}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      data-variant={TONE[workspace.kind]}
      title={`${workspace.detail} — click para cambiar de workspace`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {content}
    </button>
  );
}
