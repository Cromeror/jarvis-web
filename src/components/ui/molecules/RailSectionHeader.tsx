import React from 'react';
import { RailIcon, type RailIconName } from '../atoms/RailIcon.js';

interface RailSectionHeaderProps {
  label: string;
  icon?: RailIconName;
  className?: string;
}

/**
 * Header de sección del rail derecho (Figma "FocusSectionTitle" / header
 * ATENCIÓN / label LIVE). Con ícono → texto apagado (11px, como
 * FOCUS/ATENCIÓN); sin ícono → texto fuerte (11px, como LIVE en
 * el frame) — dos variantes reales en Figma, no una elección de diseño propia.
 */
export function RailSectionHeader({ label, icon, className = '' }: RailSectionHeaderProps): React.ReactElement {
  return (
    <div className={`flex w-full shrink-0 items-center gap-1.5 ${className}`}>
      {icon && <RailIcon name={icon} size={14} className="text-muted-foreground" />}
      <p
        className={`whitespace-nowrap text-[11px] font-semibold ${
          icon ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {label}
      </p>
    </div>
  );
}
