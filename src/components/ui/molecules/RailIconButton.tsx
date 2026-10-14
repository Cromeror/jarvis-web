import React from 'react';
import { RailIcon, type RailIconName } from '../atoms/RailIcon.js';
import { RailCountBadge, type RailCountBadgeTone } from '../atoms/RailCountBadge.js';

interface RailIconButtonProps {
  icon: RailIconName;
  active?: boolean;
  badge?: { count: number; tone: RailCountBadgeTone };
  onClick?: () => void;
  title?: string;
  /** Tarjeta rica al hacer hover (Figma ChatOptionsRail/HoverPreview) — reemplaza el tooltip nativo de `title` cuando está presente. Solo Focus/Ejecuciones la traen hoy. */
  hoverPreview?: React.ReactNode;
  className?: string;
}

/**
 * Icon-button del rail colapsado (Figma IconBtnWrapper: 48px wrapper, ícono
 * 44px con padding 2px, badge circular opcional overlay). `active` es el
 * único de los 4 items del frame con fondo de acento + borde (el acceso rápido
 * a Focus) — los otros 3 (Planes/Ejecuciones/Historial) van sin fondo, con o
 * sin badge. Mismo espíritu que Sidebar2IconButton pero con slot de badge,
 * por eso no se reusa ese átomo (namespaces separados a propósito en el DS).
 */
export function RailIconButton({ icon, active = false, badge, onClick, title, hoverPreview, className = '' }: RailIconButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hoverPreview ? undefined : title}
      aria-label={hoverPreview ? title : undefined}
      className={`group relative flex size-12 shrink-0 items-center justify-center ${className}`}
    >
      <span
        className={`flex size-11 items-center justify-center rounded-[var(--sw-r-md)] transition-colors ${
          active
            ? 'border border-[var(--sw-accent-line)] bg-[var(--sw-accent-weak)] text-primary'
            : 'text-secondary-foreground group-hover:bg-accent group-hover:text-foreground'
        }`}
      >
        <RailIcon name={icon} size={20} />
      </span>
      {badge && <RailCountBadge count={badge.count} tone={badge.tone} />}
      {hoverPreview && (
        <div className="pointer-events-none absolute right-full top-0 z-40 mr-2 opacity-0 transition-opacity delay-150 duration-150 group-hover:opacity-100">
          {hoverPreview}
        </div>
      )}
    </button>
  );
}
