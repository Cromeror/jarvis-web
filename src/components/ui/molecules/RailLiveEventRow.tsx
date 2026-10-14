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
    <div className={`flex w-full items-center gap-[var(--sw-s-2)] ${className}`}>
      <RailSemanticIcon status={status} size={16} />
      <p className="min-w-0 flex-1 truncate text-xs text-secondary-foreground">{text}</p>
      <p className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">{timestamp}</p>
    </div>
  );
}
