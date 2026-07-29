import React from 'react';
import { Sidebar2Icon, type Sidebar2IconName } from './Sidebar2Icon.js';
import { SIDEBAR2_TONE_BG_CLASS, SIDEBAR2_TONE_ICON_CLASS, type Sidebar2Tone } from './sidebar2-tones.js';

interface Sidebar2IconButtonProps {
  icon: Sidebar2IconName;
  tone?: Sidebar2Tone;
  onClick?: () => void;
  title?: string;
  className?: string;
}

/**
 * Botón cuadrado solo-ícono (Figma "SidebarAccentButton", node 7025:61 —
 * fila de swatches de la sección ATOMS). Única variante de tamaño en el
 * frame es `lg` (48px); si Figma agrega sm/md más adelante, se suma un
 * prop `size` recién ahí.
 */
export function Sidebar2IconButton({
  icon,
  tone = 'default',
  onClick,
  title,
  className = '',
}: Sidebar2IconButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex size-[48px] shrink-0 items-center justify-center rounded-[var(--sidebar2-item-radius)] p-[var(--sidebar2-lg-item-padding-v)] transition-colors ${SIDEBAR2_TONE_BG_CLASS[tone]} ${className}`}
    >
      <Sidebar2Icon name={icon} className={SIDEBAR2_TONE_ICON_CLASS[tone]} />
    </button>
  );
}
