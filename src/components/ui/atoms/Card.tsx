import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/** Generic card container — superficie de card del tema, con borde y radio del sistema, sin opinión de contenido. */
export function Card({ children, className = '', onClick }: CardProps): React.ReactElement {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-[var(--sw-r-lg)] border border-border bg-card p-[var(--sw-s-5)] text-left text-card-foreground ${
        onClick ? 'hover:bg-accent' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
