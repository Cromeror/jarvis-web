import React from 'react';
import { Sidebar2Icon, type Sidebar2IconName, type Sidebar2IconSize } from '../atoms/Sidebar2Icon.js';
import { Sidebar2IconButton } from '../atoms/Sidebar2IconButton.js';
import { SIDEBAR2_TONE_BG_CLASS, SIDEBAR2_TONE_ICON_CLASS, SIDEBAR2_TONE_TEXT_CLASS, type Sidebar2Tone } from '../atoms/sidebar2-tones.js';

export type Sidebar2NavItemTone = Sidebar2Tone;
export type Sidebar2NavItemSize = Sidebar2IconSize;

interface Sidebar2NavItemProps {
  icon: Sidebar2IconName;
  label: string;
  tone?: Sidebar2NavItemTone;
  size?: Sidebar2NavItemSize;
  collapsed?: boolean;
  onClick?: () => void;
  className?: string;
}

// Expandido: alto y tipografía por tamaño (Figma SidebarNavItem, node
// 6999:248, auditado 2026-07-29). gap/padding-h/padding-v salen de
// `--sidebar2-{size}-item-*` (bindeados 1:1 contra Variables reales vía
// get_variable_defs); alto y font-size no son Variables en Figma, son
// literales condicionales por variante — se resuelven igual acá.
const HEIGHT_CLASS: Record<Sidebar2NavItemSize, string> = {
  sm: 'h-[32px]',
  md: 'h-[40px]',
  lg: 'h-[48px]',
};

const FONT_SIZE_CLASS: Record<Sidebar2NavItemSize, string> = {
  sm: 'text-[11px]',
  md: 'text-[12px]',
  lg: 'text-[13px]',
};

// Clases completas (no interpoladas) a propósito: Tailwind detecta arbitrary
// values escaneando el string literal en el source, así que una clase armada
// en runtime por interpolación (`gap-[var(--sidebar2-${size}-item-gap)]`) no
// la encuentra y queda sin generar en el build.
const GAP_CLASS: Record<Sidebar2NavItemSize, string> = {
  sm: 'gap-[var(--sidebar2-sm-item-gap)]',
  md: 'gap-[var(--sidebar2-md-item-gap)]',
  lg: 'gap-[var(--sidebar2-lg-item-gap)]',
};

const PADDING_H_CLASS: Record<Sidebar2NavItemSize, string> = {
  sm: 'px-[var(--sidebar2-sm-item-padding-h)]',
  md: 'px-[var(--sidebar2-md-item-padding-h)]',
  lg: 'px-[var(--sidebar2-lg-item-padding-h)]',
};

const PADDING_V_CLASS: Record<Sidebar2NavItemSize, string> = {
  sm: 'py-[var(--sidebar2-sm-item-padding-v)]',
  md: 'py-[var(--sidebar2-md-item-padding-v)]',
  lg: 'py-[var(--sidebar2-lg-item-padding-v)]',
};

/**
 * Fila de navegación del Sidebar2 (Figma node 6940:83 — item-dashboard/
 * item-chat/item-plans/item-environments/item-users/item-settings, más el
 * "accent-btn" pinneado arriba). Colapsado delega 1:1 en el átomo
 * `Sidebar2IconButton` (mismo cuadrado, ni una clase distinta); expandido
 * arma la fila completa ícono+label, que en Figma es un único nodo con el
 * fondo en el contenedor entero, no un IconButton + label sueltos al lado.
 *
 * `size` (sm/md/lg, default lg) auditado 2026-07-29 contra SidebarNavItem
 * (node 6999:248) — hasta entonces solo existía la variante lg.
 */
export function Sidebar2NavItem({
  icon,
  label,
  tone = 'default',
  size = 'lg',
  collapsed = false,
  onClick,
  className = '',
}: Sidebar2NavItemProps): React.ReactElement {
  if (collapsed) {
    return <Sidebar2IconButton icon={icon} tone={tone} size={size} onClick={onClick} title={label} className={className} />;
  }

  // font-semibold en accent confirmado 1:1 contra Figma (node I7028:70;7025:67,
  // "Dashboard": Inter Semi Bold) — active en font-medium confirmado contra
  // `Sidebar/item/text-active` vía get_variable_defs (auditado 2026-07-29).
  const fontClass = tone === 'default' ? 'font-normal' : tone === 'accent' ? 'font-semibold' : 'font-medium';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex ${HEIGHT_CLASS[size]} w-full shrink-0 items-center ${GAP_CLASS[size]} overflow-hidden rounded-[var(--sidebar2-item-radius)] ${PADDING_H_CLASS[size]} ${PADDING_V_CLASS[size]} transition-colors ${SIDEBAR2_TONE_BG_CLASS[tone]} ${className}`}
    >
      <Sidebar2Icon name={icon} size={size} className={SIDEBAR2_TONE_ICON_CLASS[tone]} />
      <span className={`whitespace-nowrap ${FONT_SIZE_CLASS[size]} leading-[normal] ${fontClass} ${SIDEBAR2_TONE_TEXT_CLASS[tone]}`}>
        {label}
      </span>
    </button>
  );
}
