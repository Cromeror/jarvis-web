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
  onMenu?: () => void;
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
  onMenu,
}: EntityCardProps): React.ReactElement {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <IconTile icon={icon} className={iconClassName} />
        <div className="flex items-center gap-2">
          <StatusBadge label={statusLabel} tone={statusTone} />
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <i className="pi pi-ellipsis-v text-sm" />
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
          onClick={onAction}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          {actionLabel} →
        </button>
      </div>
    </Card>
  );
}
