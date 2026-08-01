import React from 'react';
import { RailIcon } from '../atoms/RailIcon.js';
import { Badge, type BadgeStatus } from '../atoms/Badge.js';

interface RailListRowProps {
  title: string;
  subtitle: string;
  badge?: { label: string; status: BadgeStatus };
  /** Fila clickeable (abre el detalle). Sin handler la fila queda como texto plano. */
  onClick?: () => void;
  /** Acción de lanzar — solo algunas filas la traen (en Figma, la del plan aprobado). */
  onPlay?: () => void;
  playLabel?: string;
  className?: string;
}

/**
 * Fila de la "Lista compacta" de los ContentPanel del rail derecho (Figma
 * "Row" dentro de ChatOptionsRail/ContentPanel/Planes 7532:1684 — idéntica a
 * la de Runs 7531:1677). Título + subtítulo, badge de estado opcional y botón
 * play opcional. Vive sobre la tarjeta blanca del panel, no sobre el fondo
 * oscuro del rail — de ahí los colores de texto slate y no los white/xx.
 */
export function RailListRow({
  title,
  subtitle,
  badge,
  onClick,
  onPlay,
  playLabel = 'Lanzar',
  className = '',
}: RailListRowProps): React.ReactElement {
  return (
    <div
      className={`flex w-full items-center gap-[var(--chatoptionsrail-listrow-gap)] py-[var(--chatoptionsrail-listrow-padding-v)] ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="flex min-w-0 flex-1 flex-col items-start gap-[var(--chatoptionsrail-listrow-text-gap)] text-left disabled:cursor-default"
      >
        <span className="w-full text-[13px] font-semibold text-[var(--chatoptionsrail-listrow-title-text)]">{title}</span>
        <span className="w-full text-[11px] text-[var(--chatoptionsrail-listrow-subtitle-text)]">{subtitle}</span>
      </button>

      {badge && <Badge label={badge.label} status={badge.status} size="sm" />}

      {onPlay && (
        <button
          type="button"
          onClick={onPlay}
          title={playLabel}
          aria-label={playLabel}
          className="flex shrink-0 items-center justify-center rounded-[var(--chatoptionsrail-listplay-radius)] bg-[var(--chatoptionsrail-listplay-bg)] p-[var(--chatoptionsrail-listplay-padding)] text-white transition-opacity hover:opacity-90"
        >
          <RailIcon name="play-circle" size={16} />
        </button>
      )}
    </div>
  );
}
