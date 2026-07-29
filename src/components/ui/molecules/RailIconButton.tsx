import React from 'react';
import { RailIcon, type RailIconName } from '../atoms/RailIcon.js';
import { RailCountBadge, type RailCountBadgeTone } from '../atoms/RailCountBadge.js';

interface RailIconButtonProps {
  icon: RailIconName;
  active?: boolean;
  badge?: { count: number; tone: RailCountBadgeTone };
  onClick?: () => void;
  title?: string;
  className?: string;
}

/**
 * Icon-button del rail colapsado (Figma IconBtnWrapper: 48px wrapper, ícono
 * 44px con padding 2px, badge circular opcional overlay). `active` es el
 * único de los 4 items del frame con fondo blanco + borde (el acceso rápido
 * a Focus) — los otros 3 (Planes/Ejecuciones/Historial) van sin fondo, con o
 * sin badge. Mismo espíritu que Sidebar2IconButton pero con slot de badge,
 * por eso no se reusa ese átomo (namespaces separados a propósito en el DS).
 */
export function RailIconButton({ icon, active = false, badge, onClick, title, className = '' }: RailIconButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative flex size-[var(--chatoptionsrail-iconbtn-size)] shrink-0 items-center justify-center ${className}`}
    >
      <span
        className={`flex size-[var(--chatoptionsrail-iconbtn-inner-size)] items-center justify-center rounded-[var(--chatoptionsrail-iconbtn-radius)] ${
          active
            ? 'border border-[var(--chatoptionsrail-iconbtn-active-border)] bg-[var(--chatoptionsrail-iconbtn-active-bg)] text-[var(--chatoptionsrail-button-text)]'
            : 'text-[var(--chatoptionsrail-item-text-default)]'
        }`}
      >
        <RailIcon name={icon} size={20} />
      </span>
      {badge && <RailCountBadge count={badge.count} tone={badge.tone} />}
    </button>
  );
}
