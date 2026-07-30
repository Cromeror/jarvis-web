import React from 'react';
import { TopbarIcon, type TopbarIconName } from '../atoms/TopbarIcon.js';

interface TopbarIconButtonProps {
  icon: TopbarIconName;
  badgeCount?: number;
  onClick?: () => void;
  title?: string;
  className?: string;
}

/**
 * Icon-button del Topbar (Figma IconBtnWrapper: 44×36 wrapper, ícono 32×32
 * centrado, badge circular naranja overlay 16×16). Usado por
 * EnvironmentsMenu/PipelinesMenu como trigger — mismo criterio que
 * RailIconButton (ChatOptionsRail): namespace de tokens propio, no reusa
 * el de otro rail/sidebar.
 */
export function TopbarIconButton({ icon, badgeCount, onClick, title, className = '' }: TopbarIconButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative flex h-[var(--topbar-iconbtn-size)] w-[44px] shrink-0 items-center justify-center ${className}`}
    >
      <span className="flex size-[var(--topbar-iconbtn-inner-size)] items-center justify-center rounded-[var(--topbar-radius)] text-[var(--topbar-text-secondary)] transition-colors hover:bg-white/10">
        <TopbarIcon name={icon} />
      </span>
      {badgeCount != null && badgeCount > 0 && (
        <span className="absolute -top-0.5 left-6 flex size-4 items-center justify-center rounded-[var(--topbar-radius)] bg-[var(--topbar-badge-fill)] text-[9px] font-bold text-white">
          {badgeCount}
        </span>
      )}
    </button>
  );
}
