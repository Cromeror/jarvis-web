import React from 'react';

export type BadgeStatus = 'success' | 'failed' | 'running' | 'cancelled' | 'info';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

interface BadgeProps {
  label: string;
  status?: BadgeStatus;
  size?: BadgeSize;
  className?: string;
}

const STATUS_BG_CLASS: Record<BadgeStatus, string> = {
  success: 'bg-[var(--badge-bg-success)]',
  failed: 'bg-[var(--badge-bg-error)]',
  running: 'bg-[var(--badge-bg-warning)]',
  cancelled: 'bg-[var(--badge-bg-neutral)]',
  info: 'bg-[var(--badge-bg-info)]',
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  xs: 'px-[var(--badge-xs-padding-h)] py-[var(--badge-xs-padding-v)] text-[10px]',
  sm: 'px-[var(--badge-sm-padding-h)] py-[var(--badge-sm-padding-v)] text-xs',
  md: 'px-[var(--badge-md-padding-h)] py-[var(--badge-md-padding-v)] text-[13px]',
  lg: 'px-[var(--badge-lg-padding-h)] py-[var(--badge-lg-padding-v)] text-sm',
};

/**
 * Badge — átomo base del design system "DBoard V1.1.X" (Figma node 7117:206),
 * 5 estados × 4 tamaños. Reemplaza a `StatusBadge2` (Table2) y al badge
 * píldora ad-hoc de ChatOptionsRail (`RailBadge`) — ambos habían terminado
 * siendo el mismo componente duplicado bajo namespaces de tokens distintos,
 * confirmado 1:1 contra las Variables reales de Figma (`Badge/*`). Un solo
 * color de texto para todos los estados/tamaños (`--badge-text`) — así está
 * en el frame, no es un criterio propio.
 */
export function Badge({ label, status = 'success', size = 'sm', className = '' }: BadgeProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[var(--badge-radius)] font-medium text-[var(--badge-text)] ${STATUS_BG_CLASS[status]} ${SIZE_CLASS[size]} ${className}`}
    >
      {label}
    </span>
  );
}
