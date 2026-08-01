import React from 'react';
import { RailIcon, type RailIconName } from '../atoms/RailIcon.js';
import { Badge, type BadgeStatus } from '../atoms/Badge.js';

interface RailHoverPreviewProps {
  icon: RailIconName;
  headerLabel: string;
  /** Ausente → se muestra `emptyLabel` en su lugar (nada que resumir todavía para este ítem). */
  title?: string | null;
  subtitle?: string | null;
  badge?: { label: string; status: BadgeStatus } | null;
  statusText?: string | null;
  /** Texto para el estado sin contenido — obligatorio en la práctica: sin `title` cae acá. */
  emptyLabel?: string;
  className?: string;
}

/**
 * ChatOptionsRail/HoverPreview (Figma Focus: 7347:1562, Ejecuciones:
 * 7520:36274) — tarjeta que aparece al pasar el mouse sobre un ícono del
 * rail COLAPSADO, en reemplazo del tooltip nativo (`title` de RailIconButton)
 * para los 4 ítems, sin excepción. Mismo layout para todos: header con
 * ícono, título en negrita, subtítulo y una fila de badge/estado opcional.
 * Planes/Historial no tienen HoverPreview propio en Figma (solo Focus/
 * Ejecuciones lo traen diseñado) — para esos dos, y para cualquier ítem sin
 * dato real todavía, `title` ausente activa la variante vacía (sin ella el
 * hover volvía al tooltip nativo del browser, que es justo lo que no
 * queremos: cero contraste con el resto de los hovers del rail).
 */
export function RailHoverPreview({ icon, headerLabel, title, subtitle, badge, statusText, emptyLabel, className = '' }: RailHoverPreviewProps): React.ReactElement {
  return (
    <div
      className={`flex w-[200px] flex-col items-start gap-[6px] rounded-[var(--chatoptionsrail-radius)] bg-[var(--chatoptionsrail-hoverpreview-bg)] px-[14px] py-3 shadow-[var(--chatoptionsrail-hoverpreview-shadow)] ${className}`}
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <RailIcon name={icon} size={12} className="text-[var(--chatoptionsrail-item-text-default)]" />
        <span className="whitespace-nowrap text-[10px] font-semibold text-[var(--chatoptionsrail-item-text-default)]">{headerLabel}</span>
      </div>
      {title ? (
        <>
          <p className="w-full truncate text-[14px] font-semibold text-[var(--chatoptionsrail-item-text-default)]">{title}</p>
          {subtitle && <p className="w-full truncate text-[12px] text-[var(--chatoptionsrail-item-text-default)]">{subtitle}</p>}
          {(badge || statusText) && (
            <div className="flex shrink-0 items-center gap-1.5">
              {badge && <Badge label={badge.label} status={badge.status} size="xs" />}
              {statusText && <span className="whitespace-nowrap text-[12px] font-medium text-[var(--chatoptionsrail-item-text-default)]">{statusText}</span>}
            </div>
          )}
        </>
      ) : (
        <p className="w-full text-[12px] text-[var(--chatoptionsrail-livequeue-empty-text)]">{emptyLabel ?? 'Nada para mostrar todavía.'}</p>
      )}
    </div>
  );
}
