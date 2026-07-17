import React from 'react';

export type StatusBadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone?: StatusBadgeTone;
  icon?: string;
}

const TONE_CLASS: Record<StatusBadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-indigo-100 text-indigo-600',
  warning: 'bg-orange-100 text-orange-600',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-red-100 text-red-600',
};

/** Generic pill badge for status/label display — no domain knowledge, just tone + text. */
export function StatusBadge({ label, tone = 'neutral', icon }: StatusBadgeProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      {icon && <i className={`pi ${icon} text-[9px]`} />}
      {label}
    </span>
  );
}
