import React from 'react';
import { Card } from '../atoms/Card.js';
import { IconTile } from '../atoms/IconTile.js';
import { StatusBadge, type StatusBadgeTone } from '../atoms/StatusBadge.js';

interface EntityCardProps {
  icon: string;
  iconClassName?: string;
  title: string;
  description?: string | null;
  statusLabel: string;
  statusTone?: StatusBadgeTone;
  meta?: string;
  actionLabel: string;
  onAction: () => void;
  onDelete?: () => void;
  /** Card-level click (selection). Kept separate from onAction, which stops propagation so it never fires this. */
  onSelect?: () => void;
  selected?: boolean;
}

/**
 * Generic entity summary card: icon + status badge header, title + description,
 * meta text + action link footer. No domain knowledge — caller supplies all content.
 */
export function EntityCard({
  icon,
  iconClassName,
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
  meta,
  actionLabel,
  onAction,
  onDelete,
  onSelect,
  selected = false,
}: EntityCardProps): React.ReactElement {
  // Contenedor clickeable como <div> (no <button>) a propósito: la card tiene
  // botones internos (acción, menú) y anidar <button> dentro de <button> es
  // HTML inválido. Esos controles frenan la propagación para no seleccionar.
  return (
    <div
      onClick={onSelect}
      className={`h-full rounded-2xl ${onSelect ? 'cursor-pointer' : ''} ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
    >
      <Card className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <IconTile icon={icon} className={iconClassName} />
          <div className="flex items-center gap-2">
            <StatusBadge label={statusLabel} tone={statusTone} />
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Eliminar"
                className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <i className="pi pi-trash text-sm" />
              </button>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{description}</p>}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">{meta}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            {actionLabel} →
          </button>
        </div>
      </Card>
    </div>
  );
}
