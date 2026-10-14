import React from 'react';

export type RailCountBadgeTone = 'danger' | 'accent';

interface RailCountBadgeProps {
  count: number;
  tone?: RailCountBadgeTone;
  className?: string;
}

const TONE_BG_CLASS: Record<RailCountBadgeTone, string> = {
  // Cada tono trae su tinta: el relleno de error no cambia de lado entre temas
  // (--sw-on-fill), el acento sí (--sw-on-accent, vía text-primary-foreground).
  danger: 'bg-[var(--sw-error-fill)] text-[var(--sw-on-fill)]',
  accent: 'bg-primary text-primary-foreground',
};

/**
 * Círculo de conteo del rail colapsado (Figma "Badge" dentro de IconBtnWrapper,
 * nodes 7515:816/7350:853 — 16x16, offset absolute left-[30px] top-[-2px]
 * sobre el ícono de 48x48). Distinto del átomo `Badge` (píldora, node 7117:206):
 * acá es un círculo, se posiciona solo (el padre solo necesita `position:
 * relative`), y el color es semántico por tono en vez de por status.
 */
export function RailCountBadge({ count, tone = 'accent', className = '' }: RailCountBadgeProps): React.ReactElement {
  return (
    <span
      className={`absolute -top-0.5 left-[30px] flex size-4 items-center justify-center rounded-[var(--sw-r-pill)] text-[9px] font-bold ${TONE_BG_CLASS[tone]} ${className}`}
    >
      {count}
    </span>
  );
}
