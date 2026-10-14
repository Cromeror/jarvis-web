import React from 'react';

interface SectionCardProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * SectionCard — wrapper de sección del Dashboard ("Infraestructura", "Pipelines
 * recientes"). Sin chrome propio: el borde que se ve lo aporta la tabla hija,
 * que ya es una card. Ponerle otro acá sería una card dentro de una card.
 */
export function SectionCard({ title, actions, children, className = '' }: SectionCardProps): React.ReactElement {
  return (
    <div className={`flex min-w-0 flex-col gap-[var(--sw-s-3)] ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}
