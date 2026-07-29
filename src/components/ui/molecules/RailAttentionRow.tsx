import React from 'react';
import { RailIcon } from '../atoms/RailIcon.js';
import { RailSemanticIcon } from '../atoms/RailSemanticIcon.js';
import { Badge } from '../atoms/Badge.js';

type RailAttentionRowTone = 'warning' | 'neutral';

interface RailAttentionRowProps {
  text: string;
  tone?: RailAttentionRowTone;
  badge?: string;
  onClick?: () => void;
  className?: string;
}

const TONE_BG_CLASS: Record<RailAttentionRowTone, string> = {
  warning: 'bg-[var(--chatoptionsrail-row-bg-warning)]',
  neutral: 'bg-[var(--chatoptionsrail-row-bg-neutral)]',
};

/**
 * Fila de la sección ATENCIÓN (Figma AtencionSection: alert rows en tono
 * warning + VerMasRow en tono neutral). El ícono depende del tono porque así
 * está en el frame: warning usa "Semantic Icons" (reusa RailSemanticIcon
 * status="info"), neutral (VerMasRow) usa "Icons" list-checks — no una
 * elección arbitraria, verificado bajando ambos assets exportados. Clases de
 * bg completas en `TONE_BG_CLASS` (no interpoladas) para que Tailwind las
 * detecte en build — mismo criterio que sidebar2-tones.ts/Badge.
 */
export function RailAttentionRow({ text, tone = 'warning', badge, onClick, className = '' }: RailAttentionRowProps): React.ReactElement {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-[var(--chatoptionsrail-row-gap)] rounded-[var(--chatoptionsrail-row-radius)] p-[var(--chatoptionsrail-row-padding)] text-left ${TONE_BG_CLASS[tone]} ${className}`}
    >
      {tone === 'warning' ? (
        <RailSemanticIcon status="info" size={14} />
      ) : (
        <RailIcon name="list-checks" size={14} className="text-[var(--chatoptionsrail-row-text)]" />
      )}
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--chatoptionsrail-row-text)]">{text}</p>
      {badge && <Badge label={badge} status="info" size="xs" />}
      <RailIcon name="chevron-right" size={12} className="shrink-0 text-[var(--chatoptionsrail-row-text)]" />
    </Tag>
  );
}
