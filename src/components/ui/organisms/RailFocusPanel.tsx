import React from 'react';
import { RailSectionHeader } from '../molecules/RailSectionHeader.js';
import { RailFocusCard, type RailFocusCardAction } from '../molecules/RailFocusCard.js';
import { RailAttentionRow } from '../molecules/RailAttentionRow.js';
import { RailLiveEventRow } from '../molecules/RailLiveEventRow.js';
import type { RailSemanticIconStatus } from '../atoms/RailSemanticIcon.js';

export interface RailFocusPanelProject {
  durationLabel: string;
  projectName: string;
  description: string;
  badgeLabel: string;
  updatedLabel: string;
  actions: RailFocusCardAction[];
}

export interface RailFocusPanelAttentionItem {
  id: string;
  text: string;
}

export interface RailFocusPanelLiveEvent {
  id: string;
  status: RailSemanticIconStatus;
  text: string;
  timestamp: string;
}

interface RailFocusPanelProps {
  focusProject: RailFocusPanelProject;
  attentionItems: RailFocusPanelAttentionItem[];
  onAttentionItemClick?: (id: string) => void;
  moreMessagesCount?: number;
  onMoreMessagesClick?: () => void;
  liveEvents: RailFocusPanelLiveEvent[];
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
  className = '',
}: RailFocusPanelProps): React.ReactElement {
  return (
    <div className={`flex w-full flex-col gap-[var(--chatoptionsrail-panel-gap)] ${className}`}>
      <div className="flex w-full flex-col items-start gap-2">
        <RailSectionHeader label="FOCUS" icon="target" />
        <RailFocusCard {...focusProject} />
      </div>

      <div className="flex w-full flex-col items-start gap-2.5">
        <RailSectionHeader label="ATENCIÓN" icon="warning" />
        {attentionItems.map((item) => (
          <RailAttentionRow key={item.id} text={item.text} tone="warning" onClick={() => onAttentionItemClick?.(item.id)} />
        ))}
        {moreMessagesCount != null && moreMessagesCount > 0 && (
          <RailAttentionRow text="Ver más mensajes" tone="neutral" badge={`+${moreMessagesCount}`} onClick={onMoreMessagesClick} />
        )}
      </div>

      <div className="flex w-full flex-col items-start gap-2">
        <RailSectionHeader label="LIVE" />
        <div className="flex w-full flex-col gap-[var(--chatoptionsrail-livequeue-gap)] rounded-[var(--chatoptionsrail-livequeue-radius)] bg-[var(--chatoptionsrail-livequeue-bg)] px-[var(--chatoptionsrail-livequeue-padding-h)] py-[var(--chatoptionsrail-livequeue-padding-v)]">
          {liveEvents.map((event) => (
            <RailLiveEventRow key={event.id} status={event.status} text={event.text} timestamp={event.timestamp} />
          ))}
        </div>
      </div>
    </div>
  );
}
