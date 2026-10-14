import React from 'react';

export type BadgeStatus = 'success' | 'failed' | 'running' | 'cancelled' | 'info';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

interface BadgeProps {
  label: string;
  status?: BadgeStatus;
  size?: BadgeSize;
  className?: string;
}

/** El estado de una corrida, dicho con las variantes de la `.badge` de Basecoat. */
const VARIANTE: Record<BadgeStatus, string | undefined> = {
  success: 'success',
  failed: 'error',
  running: 'warning',
  cancelled: 'mute',
  info: undefined,
};

/**
 * El tamaño sólo achica o agranda la letra: el alto y el padding son los de
 * la `.badge` del sistema, que es una sola. Los cuatro tamaños venían del
 * design system viejo, cuyos tokens (`--badge-*`) ya no existen.
 */
const TEXTO: Record<BadgeSize, string> = {
  xs: 'text-[10px]',
  sm: '',
  md: 'text-[13px]',
  lg: 'text-sm',
};

/**
 * Badge de estado de una corrida (pipeline, tarea de fondo, conversación):
 * mismo vocabulario de `status` que usa el resto del chat. Por debajo es la
 * `.badge` de Basecoat, igual que `StatusBadge` — lo que difiere es sólo el
 * nombre de los estados, que acá son los de una ejecución.
 */
export function Badge({ label, status = 'success', size = 'sm', className = '' }: BadgeProps): React.ReactElement {
  return (
    <span className={`badge whitespace-nowrap ${TEXTO[size]} ${className}`.trim()} data-variant={VARIANTE[status]}>
      {label}
    </span>
  );
}
