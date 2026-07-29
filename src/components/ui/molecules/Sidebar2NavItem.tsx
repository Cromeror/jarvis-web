import React from 'react';
import { Sidebar2Icon, type Sidebar2IconName } from '../atoms/Sidebar2Icon.js';
import { Sidebar2IconButton } from '../atoms/Sidebar2IconButton.js';
import { SIDEBAR2_TONE_BG_CLASS, SIDEBAR2_TONE_ICON_CLASS, SIDEBAR2_TONE_TEXT_CLASS, type Sidebar2Tone } from '../atoms/sidebar2-tones.js';

export type Sidebar2NavItemTone = Sidebar2Tone;

interface Sidebar2NavItemProps {
  icon: Sidebar2IconName;
  label: string;
  tone?: Sidebar2NavItemTone;
  collapsed?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Fila de navegación del Sidebar2 (Figma node 6940:83 — item-dashboard/
 * item-chat/item-plans/item-environments/item-users/item-settings, más el
 * "accent-btn" pinneado arriba). Colapsado delega 1:1 en el átomo
 * `Sidebar2IconButton` (mismo cuadrado 48px, ni una clase distinta);
 * expandido arma la fila completa ícono+label, que en Figma es un único
 * nodo con el fondo en el contenedor entero, no un IconButton + label
 * sueltos al lado.
 */
export function Sidebar2NavItem({
  icon,
  label,
  tone = 'default',
  collapsed = false,
  onClick,
  className = '',
}: Sidebar2NavItemProps): React.ReactElement {
  if (collapsed) {
    return <Sidebar2IconButton icon={icon} tone={tone} onClick={onClick} title={label} className={className} />;
  }

  // font-semibold en accent confirmado 1:1 contra Figma (node I7028:70;7025:67,
  // "Dashboard": Inter Semi Bold) — active queda en font-medium sin confirmar
  // (ningún ítem del frame se renderiza en ese estado, ver sidebar2-tones.ts).
  const fontClass = tone === 'default' ? 'font-normal' : tone === 'accent' ? 'font-semibold' : 'font-medium';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[48px] w-full shrink-0 items-center gap-[var(--sidebar2-lg-item-gap)] overflow-hidden rounded-[var(--sidebar2-item-radius)] p-[var(--sidebar2-lg-item-padding-v)] transition-colors ${SIDEBAR2_TONE_BG_CLASS[tone]} ${className}`}
    >
      <Sidebar2Icon name={icon} className={SIDEBAR2_TONE_ICON_CLASS[tone]} />
      <span className={`whitespace-nowrap text-[13px] leading-[normal] ${fontClass} ${SIDEBAR2_TONE_TEXT_CLASS[tone]}`}>{label}</span>
    </button>
  );
}
