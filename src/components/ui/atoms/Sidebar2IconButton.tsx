import React from 'react';
import { Sidebar2Icon, type Sidebar2IconName, type Sidebar2IconSize } from './Sidebar2Icon.js';
import { SIDEBAR2_TONE_BG_CLASS, SIDEBAR2_TONE_ICON_CLASS, type Sidebar2Tone } from './sidebar2-tones.js';

interface Sidebar2IconButtonProps {
  icon: Sidebar2IconName;
  tone?: Sidebar2Tone;
  size?: Sidebar2IconSize;
  onClick?: () => void;
  title?: string;
  className?: string;
}

const BOX_CLASS: Record<Sidebar2IconSize, string> = {
  sm: 'size-[32px]',
  md: 'size-[40px]',
  lg: 'size-[48px]',
};

// Padding del cuadrado colapsado (15/12/9px lg/md/sm) — literal en Figma
// (SidebarNavItem, node 6999:248), sin Variable propia bindeada; no coincide
// 1:1 con `--sidebar2-{size}-item-padding-v` (esos son del estado expandido).
const COLLAPSED_PADDING_CLASS: Record<Sidebar2IconSize, string> = {
  sm: 'p-[9px]',
  md: 'p-[12px]',
  lg: 'p-[15px]',
};

/**
 * Botón cuadrado solo-ícono (Figma "SidebarAccentButton", node 7025:61 —
 * fila de swatches de la sección ATOMS). `size` (sm/md/lg) auditado
 * 2026-07-29 contra SidebarNavItem (node 6999:248): 32/40/48px con padding
 * 9/12/15px respectivamente.
 */
export function Sidebar2IconButton({
  icon,
  tone = 'default',
  size = 'lg',
  onClick,
  title,
  className = '',
}: Sidebar2IconButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex ${BOX_CLASS[size]} shrink-0 items-center justify-center rounded-[var(--sidebar2-item-radius)] ${COLLAPSED_PADDING_CLASS[size]} transition-colors ${SIDEBAR2_TONE_BG_CLASS[tone]} ${className}`}
    >
      <Sidebar2Icon name={icon} size={size} className={SIDEBAR2_TONE_ICON_CLASS[tone]} />
    </button>
  );
}
