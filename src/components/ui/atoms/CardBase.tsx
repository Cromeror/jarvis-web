import React from 'react';

export type CardBaseGap = 'sm' | 'md';

interface CardBaseProps {
  children: React.ReactNode;
  gap?: CardBaseGap;
  onClick?: () => void;
  className?: string;
}

const GAP_CLASS: Record<CardBaseGap, string> = {
  sm: 'gap-[var(--card-gap-sm)]',
  md: 'gap-[var(--card-gap)]',
};

/**
 * CardBase — átomo del design system "DBoard V1.1.X" (Figma node 7054:259).
 * Superficie con gradiente sutil y borde translúcido, sin tamaño fijo — se
 * adapta al contenido/contenedor (el frame de 388x133 en Figma es el tamaño
 * de esa instancia de ejemplo, no una medida intrínseca del componente).
 * `gap` cubre las dos separaciones entre filas que aparecen en el archivo de
 * Figma para componentes que envuelven esta superficie (8px en CardBase,
 * 12px en CardProject) — no una preferencia propia de este átomo.
 */
export function CardBase({ children, gap = 'sm', onClick, className = '' }: CardBaseProps): React.ReactElement {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-col items-start text-left ${GAP_CLASS[gap]} overflow-clip rounded-[var(--card-radius)] border border-[var(--card-border)] bg-[var(--card-bg-base)] bg-gradient-to-b from-[var(--card-bg-from)] to-[var(--card-bg-to)] px-[var(--card-padding-h)] py-[var(--card-padding-v)] ${className}`}
    >
      {children}
    </Tag>
  );
}
