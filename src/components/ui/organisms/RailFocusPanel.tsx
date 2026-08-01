import React from 'react';
import { RailSectionHeader } from '../molecules/RailSectionHeader.js';
import { RailFocusCard, type RailFocusCardAction } from '../molecules/RailFocusCard.js';
import { RailAttentionRow, type RailAttentionRowAction } from '../molecules/RailAttentionRow.js';
import { RailLiveEventRow } from '../molecules/RailLiveEventRow.js';
import type { RailSemanticIconStatus } from '../atoms/RailSemanticIcon.js';
import type { BadgeStatus } from '../atoms/Badge.js';

export interface RailFocusPanelProject {
  durationLabel: string;
  projectName: string;
  description: string;
  title?: string | null;
  badge?: { label: string; status: BadgeStatus } | null;
  updatedLabel?: string | null;
  suggestedPlanTitle?: string | null;
  actions?: RailFocusCardAction[];
}

export interface RailFocusPanelAttentionItem {
  id: string;
  text: string;
  /** `warning` (pendiente de atención) o `neutral` — mismo criterio que RailAttentionRow. */
  tone?: 'warning' | 'neutral';
  /** Resolver sin salir del rail (ej. aprobar el plan que espera aprobación). */
  action?: RailAttentionRowAction;
  /** Silenciar: sale del Inbox sin navegar. Ausente = la fila no se puede silenciar. */
  onDismiss?: () => void;
}

export interface RailFocusPanelLiveEvent {
  id: string;
  status: RailSemanticIconStatus;
  text: string;
  timestamp: string;
}

interface RailFocusPanelProps {
  /** null = la conversación activa todavía no reportó foco (o no hay conversación abierta). */
  focusProject: RailFocusPanelProject | null;
  attentionItems: RailFocusPanelAttentionItem[];
  onAttentionItemClick?: (id: string) => void;
  moreMessagesCount?: number;
  onMoreMessagesClick?: () => void;
  liveEvents: RailFocusPanelLiveEvent[];
  /** Click en el header FOCUS — Focus es un ítem más del acordeón del rail, así que también se pliega a su RailNavItem. */
  onToggle?: () => void;
  className?: string;
}

/**
 * ChatOptionsRail/ContentPanel/Focus (Organism) — literal en Figma. Compone
 * FOCUS (header + RailFocusCard), ATENCIÓN (header + RailAttentionRow[] +
 * fila "Ver más mensajes") y LIVE (header + RailLiveEventRow[]). En el frame
 * de Figma este organismo trae su propio bg-gradient/radius/padding, idéntico
 * al de ChatOptionsRail (mismos tokens) — se omite acá para no duplicar la
 * misma superficie dos veces sin diferencia visual; el padding/gradiente lo
 * aporta una sola vez el organismo `ChatOptionsRail` que lo envuelve.
 */
export function RailFocusPanel({
  focusProject,
  attentionItems,
  onAttentionItemClick,
  moreMessagesCount,
  onMoreMessagesClick,
  liveEvents,
  onToggle,
  className = '',
}: RailFocusPanelProps): React.ReactElement {
  return (
    <div className={`flex w-full flex-col gap-[var(--chatoptionsrail-panel-gap)] ${className}`}>
      <div className="flex w-full flex-col items-start gap-2">
        <button type="button" onClick={onToggle} className="w-full text-left" title="Plegar focus">
          <RailSectionHeader label="FOCUS" icon="target" />
        </button>
        {focusProject ? (
          <RailFocusCard {...focusProject} />
        ) : (
          // El diseño no tiene variante vacía de la card; se reusa la misma
          // superficie/tono que el estado vacío de LIVE para no inventar una.
          <div className="flex w-full flex-col items-center rounded-[var(--chatoptionsrail-livequeue-radius)] bg-[var(--chatoptionsrail-livequeue-bg)] px-[var(--chatoptionsrail-livequeue-padding-h)] py-[var(--chatoptionsrail-livequeue-empty-padding-v)]">
            <p className="text-center text-xs text-[var(--chatoptionsrail-livequeue-empty-text)]">
              Sin foco reportado en esta conversación
            </p>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col items-start gap-2.5">
        <RailSectionHeader label="ATENCIÓN" icon="warning" />
        {attentionItems.length === 0 && (
          <div className="flex w-full flex-col items-center rounded-[var(--chatoptionsrail-livequeue-radius)] bg-[var(--chatoptionsrail-livequeue-bg)] px-[var(--chatoptionsrail-livequeue-padding-h)] py-[var(--chatoptionsrail-livequeue-empty-padding-v)]">
            <p className="text-center text-xs text-[var(--chatoptionsrail-livequeue-empty-text)]">Nada pendiente</p>
          </div>
        )}
        {attentionItems.map((item) => (
          <RailAttentionRow
            key={item.id}
            text={item.text}
            tone={item.tone ?? 'warning'}
            onClick={() => onAttentionItemClick?.(item.id)}
            action={item.action}
            onDismiss={item.onDismiss}
          />
        ))}
        {moreMessagesCount != null && moreMessagesCount > 0 && (
          <RailAttentionRow text="Ver más mensajes" tone="neutral" badge={`+${moreMessagesCount}`} onClick={onMoreMessagesClick} />
        )}
      </div>

      <div className="flex w-full flex-col items-start gap-2">
        <RailSectionHeader label="LIVE" />
        {liveEvents.length === 0 ? (
          <div className="flex w-full flex-col items-center rounded-[var(--chatoptionsrail-livequeue-radius)] bg-[var(--chatoptionsrail-livequeue-bg)] px-[var(--chatoptionsrail-livequeue-padding-h)] py-[var(--chatoptionsrail-livequeue-empty-padding-v)]">
            <p className="text-center text-xs text-[var(--chatoptionsrail-livequeue-empty-text)]">Sin actividad reciente</p>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-[var(--chatoptionsrail-livequeue-gap)] rounded-[var(--chatoptionsrail-livequeue-radius)] bg-[var(--chatoptionsrail-livequeue-bg)] px-[var(--chatoptionsrail-livequeue-padding-h)] py-[var(--chatoptionsrail-livequeue-padding-v)]">
            {liveEvents.map((event) => (
              <RailLiveEventRow key={event.id} status={event.status} text={event.text} timestamp={event.timestamp} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
