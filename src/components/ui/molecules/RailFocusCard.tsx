import React from 'react';
import { RailIcon } from '../atoms/RailIcon.js';
import { Badge, type BadgeStatus } from '../atoms/Badge.js';
import { RailButton } from '../atoms/RailButton.js';

export interface RailFocusCardAction {
  label: string;
  onClick?: () => void;
}

interface RailFocusCardProps {
  durationLabel: string;
  projectName: string;
  description: string;
  /**
   * Focus title reported by the model (notify_focus_update's `title`). Figma
   * has no slot for it in either variant — the target row is the project and
   * the line below is the summary — so it renders between them only when the
   * model actually reports one, leaving the designed layout untouched when it
   * doesn't. Pending confirmation on where it should live in the design.
   */
  title?: string | null;
  /** Plan state of this conversation. Absent = the "sin plan activo" variant. */
  badge?: { label: string; status: BadgeStatus } | null;
  updatedLabel?: string | null;
  /** Plan the model proposed without creating it — shown as the "PLAN SUGERIDO" block. */
  suggestedPlanTitle?: string | null;
  actions?: RailFocusCardAction[];
  className?: string;
}

/**
 * Card naranja de foco activo (Figma "Frame" dentro de ChatOptionsRail/
 * ContentPanel/Focus (Organism), node I7421:892;7361:1625 con plan y 7472:905
 * sin plan). Envuelve DurationIndicator + nombre de proyecto + descripción +
 * badge/timestamp + bloque PLAN SUGERIDO + acciones. No es CardBase: bg sólido
 * de acento (no gradiente sutil) y radius propio (16px vs 12px de CardBase) —
 * namespace de tokens separado a propósito.
 *
 * Las dos variantes del diseño viven acá y ramifican por datos, no por
 * componente: con plan llegan `badge`/`updatedLabel` y las acciones
 * Aprobar/Lanzar; sin plan no hay badge (no existe Plan todavía) y en su lugar
 * llega `suggestedPlanTitle` con la acción Crear plan.
 */
export function RailFocusCard({
  durationLabel,
  projectName,
  description,
  title = null,
  badge = null,
  updatedLabel = null,
  suggestedPlanTitle = null,
  actions = [],
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

      {title && (
        <p className="text-[13px] font-semibold text-[var(--chatoptionsrail-text-on-accent-strong)]">{title}</p>
      )}

      <p className="text-xs text-[var(--chatoptionsrail-text-on-accent)]">{description}</p>

      {badge && (
        <div className="flex items-center gap-2">
          <Badge label={badge.label} status={badge.status} size="xs" />
          {updatedLabel && (
            <p className="whitespace-nowrap text-[11px] text-[var(--chatoptionsrail-timestamp-text)]">{updatedLabel}</p>
          )}
        </div>
      )}

      {suggestedPlanTitle && (
        <div className="flex w-full flex-col items-start gap-0.5">
          <p className="whitespace-nowrap text-[11px] font-semibold tracking-[0.66px] text-[var(--chatoptionsrail-text-on-accent-muted)]">
            PLAN SUGERIDO
          </p>
          <p className="text-sm font-semibold text-[var(--chatoptionsrail-text-on-accent-strong)]">{suggestedPlanTitle}</p>
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex items-start gap-[var(--chatoptionsrail-button-gap)]">
          {actions.map((action) => (
            <RailButton key={action.label} label={action.label} onClick={action.onClick} />
          ))}
        </div>
      )}
    </div>
  );
}
