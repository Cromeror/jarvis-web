import React from 'react';

export type StatusBadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone?: StatusBadgeTone;
  icon?: string;
}

/**
 * El tono se traduce a la `data-variant` de la `.badge` de Basecoat, que es la
 * que pinta: así el color sale de los tokens `--sw-*-bg`/`--sw-on-*` y se
 * re-tiñe solo con el tema. `info` va SIN variante porque la badge base ya es
 * la del acento — inventarle una variante `info` sería un quinto color que el
 * sistema no tiene.
 */
const VARIANTE: Record<StatusBadgeTone, string | undefined> = {
  neutral: 'mute',
  info: undefined,
  warning: 'warning',
  success: 'success',
  danger: 'error',
};

/** Generic pill badge for status/label display — no domain knowledge, just tone + text. */
export function StatusBadge({ label, tone = 'neutral', icon }: StatusBadgeProps): React.ReactElement {
  return (
    <span className="badge" data-variant={VARIANTE[tone]}>
      {icon && <i className={`pi ${icon} text-[9px]`} />}
      {label}
    </span>
  );
}
