import React from 'react';
import { Card } from '../atoms/Card.js';
import { IconTile } from '../atoms/IconTile.js';

interface EmptyCardProps {
  icon?: string;
  title?: string;
  description?: string;
  onClick?: () => void;
}

/**
 * Dashed-border placeholder card — centered icon + title + description, all
 * optional. Built on the shared Card atom for an "add new" / empty-state slot.
 */
export function EmptyCard({ icon = 'pi-plus', title, description, onClick }: EmptyCardProps): React.ReactElement {
  return (
    <Card
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-slate-300 bg-slate-50/50 py-10 text-center shadow-none"
    >
      <IconTile icon={icon} shape="circle" size={64} className="bg-slate-100 text-slate-500" />
      <div>
        {title && <h3 className="text-lg font-medium text-slate-800">{title}</h3>}
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
    </Card>
  );
}
