import React from 'react';

interface SectionCardProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * SectionCard — wrapper genérico de sección del Dashboard (Figma
 * "Card/Section", nodes 7093:156/7093:166 — "Infraestructura"/"Recent
 * Pipelines"). Sin chrome propio: bg/border transparentes en el frame, el
 * borde visible que se ve en cada sección lo aporta la tabla hija (Table2/
 * InfrastructureTable), no este wrapper. Padding/gap reusan --card-padding-h/v
 * y --card-gap (mismo valor 16/16/12 que Card/Section/* en Figma).
 */
export function SectionCard({ title, actions, children, className = '' }: SectionCardProps): React.ReactElement {
  return (
    <div className={`flex flex-col gap-[var(--card-gap)] px-[var(--card-padding-h)] py-[var(--card-padding-v)] ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--card-text-primary)]">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}
