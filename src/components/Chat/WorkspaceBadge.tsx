import React from 'react';
import type { SessionWorkspace } from '../../lib/session-workspace.js';

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
const TONE: Record<SessionWorkspace['kind'], string> = {
  base: 'bg-slate-100 text-slate-600',
  replica: 'bg-indigo-100 text-indigo-700',
  unknown: 'bg-rose-100 text-rose-700',
};

export function WorkspaceBadge({ workspace, onClick, size = 'sm' }: WorkspaceBadgeProps): React.ReactElement {
  const className = [
    'inline-flex w-fit shrink-0 items-center gap-1 rounded-full font-semibold',
    size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
    TONE[workspace.kind],
    onClick ? 'cursor-pointer hover:brightness-95' : '',
  ].join(' ');

  const content = (
    <>
      <i className={`pi ${workspace.kind === 'unknown' ? 'pi-exclamation-triangle' : 'pi-folder'} text-[9px]`} />
      {workspace.label}
    </>
  );

  if (!onClick) {
    return (
      <span className={className} title={workspace.detail}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
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
