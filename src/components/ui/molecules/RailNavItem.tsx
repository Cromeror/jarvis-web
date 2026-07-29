import React from 'react';
import { RailIcon, type RailIconName } from '../atoms/RailIcon.js';

interface RailNavItemProps {
  icon: RailIconName;
  label: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Ítem de navegación expandido del rail derecho (Figma PlanesNavItem/
 * EjecucionesNavItem/HistorialNavItem, estado expandido — 33px alto, 200px
 * ancho fijo tal cual el frame, sin fondo/tone). Distinto de Sidebar2NavItem
 * (48px, con fondo por tono) — no reusar, es un molecule liviano propio.
 */
export function RailNavItem({ icon, label, onClick, className = '' }: RailNavItemProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[var(--chatoptionsrail-item-height)] w-[200px] shrink-0 items-center gap-2 rounded-[var(--chatoptionsrail-item-radius)] px-[var(--chatoptionsrail-item-padding-h)] py-[var(--chatoptionsrail-item-padding-v)] transition-colors hover:bg-white/10 ${className}`}
    >
      <RailIcon name={icon} size={16} className="text-[var(--chatoptionsrail-item-text-default)]" />
      <span className="whitespace-nowrap text-sm font-medium text-[var(--chatoptionsrail-item-text-default)]">{label}</span>
    </button>
  );
}
