import React from 'react';
import { RailIcon } from '../atoms/RailIcon.js';
import { Badge, type BadgeStatus } from '../atoms/Badge.js';

interface RailListRowProps {
  title: string;
  subtitle: string;
  /**
   * Estado efímero de la fila ('Respondiendo…'), alineado a la derecha en la
   * MISMA línea que el subtítulo (que en Historial es el tiempo) — de ahí el
   * justify-between. Comparte la tipografía del subtítulo a propósito: es
   * metadata de la fila, no un badge. Ausente = nada que informar, y esa
   * ausencia es justamente la señal de "ya terminó".
   */
  status?: string;
  badge?: { label: string; status: BadgeStatus };
  /** Fila clickeable (abre el detalle). Sin handler la fila queda como texto plano. */
  onClick?: () => void;
  /** Acción de lanzar — solo algunas filas la traen (en Figma, la del plan aprobado). */
  onPlay?: () => void;
  playLabel?: string;
  /**
   * Fila actualmente abierta en el chat — se marca con un borde de acento del
   * lado izquierdo. El borde se dibuja SIEMPRE (transparente cuando no está
   * seleccionada) para que marcarla no corra el texto de las demás.
   */
  selected?: boolean;
  /** Acción destructiva opcional (en Historial, eliminar la conversación). */
  onDelete?: () => void;
  deleteLabel?: string;
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
  status,
  badge,
  onClick,
  onPlay,
  playLabel = 'Lanzar',
  selected = false,
  onDelete,
  deleteLabel = 'Eliminar',
  className = '',
}: RailListRowProps): React.ReactElement {
  return (
    <div
      aria-current={selected ? 'true' : undefined}
      className={`flex h-[var(--chatoptionsrail-listrow-height)] w-full items-center gap-[var(--chatoptionsrail-listrow-gap)] overflow-hidden border-l-2 pl-2 ${
        selected ? 'border-[var(--chatoptionsrail-listrow-selected-border)]' : 'border-transparent'
      } ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        // El texto completo va en el tooltip: la fila tiene alto fijo, así
        // que el título se elipsa y sin esto la información elidida no
        // tendría ningún recurso.
        title={title}
        className="flex min-w-0 flex-1 flex-col items-start gap-[var(--chatoptionsrail-listrow-text-gap)] text-left disabled:cursor-default"
      >
        {/* Una línea, elipsada. Los títulos de plan son largos de verdad
            ("DECISIONES (no implementa): las 9 abiertas del paralelismo…"),
            así que sin truncate una sola fila ocupaba 3-4 líneas y el tope
            de items no alcanzaba para acotar el alto del panel. */}
        <span className="w-full truncate text-[13px] font-semibold leading-[18px] text-[var(--chatoptionsrail-listrow-title-text)]">
          {title}
        </span>
        <span className="flex w-full items-center justify-between gap-2 text-[11px] leading-[14px] text-[var(--chatoptionsrail-listrow-subtitle-text)]">
          <span className="min-w-0 truncate">{subtitle}</span>
          {status && <span className="shrink-0 text-[var(--chatoptionsrail-listrow-status-text)]">{status}</span>}
        </span>
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

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title={deleteLabel}
          aria-label={deleteLabel}
          className="flex shrink-0 items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <i className="pi pi-trash text-sm" />
        </button>
      )}
    </div>
  );
}
