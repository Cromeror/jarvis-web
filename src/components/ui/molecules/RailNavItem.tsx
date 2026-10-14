import React from 'react';
import { RailIcon, type RailIconName } from '../atoms/RailIcon.js';

interface RailNavItemProps {
  icon: RailIconName;
  label: string;
  /** El panel que abre este ítem es el que está visible en el rail. */
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Ítem de navegación expandido del rail derecho (Figma PlanesNavItem/
 * EjecucionesNavItem/HistorialNavItem, estado expandido — 33px alto, ancho
 * FILL del contenedor, sin fondo/tone propio). El frame de referencia lo
 * traía fijo en 200px (bug de autolayout, corregido en Figma a FILL — mismo
 * ancho que la instancia de Focus al lado); acá se sigue el mismo criterio
 * con `w-full` en vez de copiar el literal. Distinto de Sidebar2NavItem
 * (48px, con fondo por tono) — no reusar, es un molecule liviano propio.
 * `active` no viene del frame: los ítems ahora conmutan el ContentPanel del
 * rail (Focus / Planes / etc.), así que hace falta marcar cuál está abierto
 * — se resuelve con el mismo fondo del hover (`bg-accent`), sin color nuevo.
 */
export function RailNavItem({ icon, label, active = false, onClick, className = '' }: RailNavItemProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-[33px] w-full shrink-0 items-center gap-[var(--sw-s-2)] rounded-[var(--sw-r-md)] px-[var(--sw-s-2)] transition-colors hover:bg-accent hover:text-foreground ${
        active ? 'bg-accent text-foreground' : 'text-secondary-foreground'
      } ${className}`}
    >
      <RailIcon name={icon} size={16} />
      <span className="whitespace-nowrap text-sm font-medium">{label}</span>
    </button>
  );
}
