import React from 'react';
import { RailSemanticIcon, type RailSemanticIconStatus } from '../atoms/RailSemanticIcon.js';

interface RailLiveEventRowProps {
  status: RailSemanticIconStatus;
  text: string;
  timestamp: string;
  className?: string;
}

/** Fila de LiveQueue (Figma LiveSection → EventRow): ícono de estado + texto + tiempo relativo. */
export function RailLiveEventRow({ status, text, timestamp, className = '' }: RailLiveEventRowProps): React.ReactElement {
  return (
    <div className={`flex w-full items-center gap-[var(--chatoptionsrail-eventrow-gap)] ${className}`}>
      <RailSemanticIcon status={status} size={16} />
      <p className="min-w-0 flex-1 truncate text-xs text-[var(--chatoptionsrail-text-on-accent)]">{text}</p>
      <p className="shrink-0 whitespace-nowrap text-[11px] text-[var(--chatoptionsrail-eventrow-timestamp-text)]">{timestamp}</p>
    </div>
  );
}
