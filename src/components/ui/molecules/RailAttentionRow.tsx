import React from 'react';
import { RailIcon } from '../atoms/RailIcon.js';
import { RailSemanticIcon } from '../atoms/RailSemanticIcon.js';
import { RailButton } from '../atoms/RailButton.js';
import { Badge } from '../atoms/Badge.js';
import { Icons } from '../atoms/Icons.js';

type RailAttentionRowTone = 'warning' | 'neutral';

export interface RailAttentionRowAction {
  label: string;
  onClick: () => void;
}

interface RailAttentionRowProps {
  text: string;
  tone?: RailAttentionRowTone;
  badge?: string;
  /** Ir a donde está la acción — además marca la fila como atendida (lo decide el caller). */
  onClick?: () => void;
  /** Resolver sin moverse de acá (ej. "Aprobar" el plan que pide aprobación). */
  action?: RailAttentionRowAction;
  /** Silenciar: la fila se va del Inbox sin navegar ni resolver nada. */
  onDismiss?: () => void;
  className?: string;
}

// El tono trae fondo Y tinta: el texto de la fila hereda (`text-current` en los
// hijos), así que una sola clase decide el par y no pueden desacoplarse.
const TONE_BG_CLASS: Record<RailAttentionRowTone, string> = {
  warning: 'bg-[var(--sw-warning-bg)] text-[var(--sw-on-warning)]',
  neutral: 'bg-muted text-secondary-foreground',
};

/**
 * Fila de la sección ATENCIÓN (Figma AtencionSection: alert rows en tono
 * warning + VerMasRow en tono neutral). El ícono depende del tono porque así
 * está en el frame: warning usa "Semantic Icons" (reusa RailSemanticIcon
 * status="info"), neutral (VerMasRow) usa "Icons" list-checks — no una
 * elección arbitraria, verificado bajando ambos assets exportados. Clases de
 * bg completas en `TONE_BG_CLASS` (no interpoladas) para que Tailwind las
 * detecte en build — mismo criterio que sidebar2-tones.ts/Badge.
 *
 * La acción inline y el botón de silenciar NO están en el diseño: se agregan
 * porque el Inbox necesita poder vaciarse (una fila atendida no puede quedar
 * ahí para siempre) y porque resolver desde la fila evita el viaje de ida y
 * vuelta. Por eso la raíz es un div con el área principal como botón adentro,
 * en vez del botón único que era antes: anidar botones es HTML inválido.
 */
export function RailAttentionRow({
  text,
  tone = 'warning',
  badge,
  onClick,
  action,
  onDismiss,
  className = '',
}: RailAttentionRowProps): React.ReactElement {
  const MainTag = onClick ? 'button' : 'div';

  return (
    <div
      className={`flex w-full items-center gap-[var(--sw-s-2)] rounded-[var(--sw-r-md)] p-[var(--sw-s-2)] ${TONE_BG_CLASS[tone]} ${className}`}
    >
      <MainTag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-[var(--sw-s-2)] text-left"
      >
        {tone === 'warning' ? (
          <RailSemanticIcon status="info" size={14} />
        ) : (
          <RailIcon name="list-checks" size={14} />
        )}
        <p className="min-w-0 flex-1 text-[13px] font-semibold">{text}</p>
        {badge && <Badge label={badge} status="info" size="xs" />}
        {onClick && <RailIcon name="chevron-right" size={12} className="shrink-0" />}
      </MainTag>

      {action && <RailButton label={action.label} onClick={action.onClick} className="shrink-0" />}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          title="Silenciar"
          aria-label={`Silenciar: ${text}`}
          className="shrink-0 opacity-60 hover:opacity-100"
        >
          <Icons icon="x-circle" size={14} />
        </button>
      )}
    </div>
  );
}
