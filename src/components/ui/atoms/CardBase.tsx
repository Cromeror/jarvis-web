import React from 'react';

export type CardBaseGap = 'sm' | 'md';

interface CardBaseProps {
  children: React.ReactNode;
  gap?: CardBaseGap;
  onClick?: () => void;
  className?: string;
}

const GAP_CLASS: Record<CardBaseGap, string> = {
  sm: 'gap-[var(--sw-s-2)]',
  md: 'gap-[var(--sw-s-3)]',
};

/**
 * CardBase — la superficie de card del tema, sin tamaño fijo: se adapta al
 * contenido o al contenedor. `gap` cubre las dos separaciones entre filas que
 * usan quienes la envuelven (8px y 12px), no una preferencia de este átomo.
 *
 * Clickeable, se aclara al pasar con `bg-accent`, que es el hover de todo el
 * sistema: la card entera es el objetivo, no un link adentro de ella.
 */
export function CardBase({ children, gap = 'sm', onClick, className = '' }: CardBaseProps): React.ReactElement {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-col items-start text-left ${GAP_CLASS[gap]} overflow-clip rounded-[var(--sw-r-lg)] border border-border bg-card p-[var(--sw-s-4)] text-card-foreground transition-colors ${
        onClick ? 'hover:bg-accent' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
