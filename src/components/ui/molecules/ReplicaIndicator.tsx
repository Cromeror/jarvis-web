import React from 'react';

interface ReplicaIndicatorProps {
  active: number;
  total: number;
  className?: string;
}

/**
 * ReplicaIndicator — dots + "X/Y réplicas" (Figma "replica-dots" dentro de
 * Table/Infraestructura). Dot activo/inactivo por índice (los primeros
 * `active` dots se pintan activos), igual que el frame de Figma.
 */
export function ReplicaIndicator({ active, total, className = '' }: ReplicaIndicatorProps): React.ReactElement {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`size-[7px] shrink-0 rounded-[2px] ${
              i < active ? 'bg-[var(--statusdot-secondary-active)]' : 'bg-[var(--statusdot-secondary-inactive)]'
            }`}
          />
        ))}
      </div>
      <p className="whitespace-nowrap text-xs text-[var(--card-text-secondary)]">
        {active}/{total} réplicas
      </p>
    </div>
  );
}
