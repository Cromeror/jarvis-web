import React from 'react';
import { RailIcon } from '../atoms/RailIcon.js';
import { Badge } from '../atoms/Badge.js';
import { RailButton } from '../atoms/RailButton.js';

export interface RailFocusCardAction {
  label: string;
  onClick?: () => void;
}

interface RailFocusCardProps {
  durationLabel: string;
  projectName: string;
  description: string;
  badgeLabel: string;
  updatedLabel: string;
  actions: RailFocusCardAction[];
  className?: string;
}

/**
 * Card naranja de foco activo (Figma "Frame" dentro de ChatOptionsRail/
 * ContentPanel/Focus (Organism), node I7421:892;7361:1625). Envuelve
 * DurationIndicator + nombre de proyecto + descripción + badge/timestamp +
 * acciones. No es CardBase: bg sólido de acento (no gradiente sutil) y radius
 * propio (16px vs 12px de CardBase) — namespace de tokens separado a propósito.
 */
export function RailFocusCard({
  durationLabel,
  projectName,
  description,
  badgeLabel,
  updatedLabel,
  actions,
  className = '',
}: RailFocusCardProps): React.ReactElement {
  return (
    <div
      className={`flex w-full flex-col gap-[var(--chatoptionsrail-focuscard-gap)] rounded-[var(--chatoptionsrail-focuscard-radius)] bg-[var(--chatoptionsrail-focuscard-bg)] px-[var(--chatoptionsrail-focuscard-padding-h)] py-[var(--chatoptionsrail-focuscard-padding-v)] ${className}`}
    >
      <div className="flex items-center gap-1">
        <RailIcon name="clock" size={12} className="text-[var(--chatoptionsrail-text-on-accent)]" />
        <p className="whitespace-nowrap text-[11px] font-medium text-[var(--chatoptionsrail-text-on-accent)]">{durationLabel}</p>
      </div>

      <div className="flex items-center gap-1.5">
        <RailIcon name="target" size={14} className="text-[var(--chatoptionsrail-text-on-accent-strong)]" />
        <p className="whitespace-nowrap text-sm font-semibold text-[var(--chatoptionsrail-text-on-accent-strong)]">{projectName}</p>
      </div>

      <p className="text-xs text-[var(--chatoptionsrail-text-on-accent)]">{description}</p>

      <div className="flex items-center gap-2">
        <Badge label={badgeLabel} status="info" size="xs" />
        <p className="whitespace-nowrap text-[11px] text-[var(--chatoptionsrail-timestamp-text)]">{updatedLabel}</p>
      </div>

      <div className="flex items-start gap-[var(--chatoptionsrail-button-gap)]">
        {actions.map((action) => (
          <RailButton key={action.label} label={action.label} onClick={action.onClick} />
        ))}
      </div>
    </div>
  );
}
