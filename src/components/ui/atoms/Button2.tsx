import React from 'react';

export type Button2Variant = 'primary' | 'secondary';
export type Button2Size = 'md' | 'xs';

interface Button2Props {
  label: string;
  variant?: Button2Variant;
  size?: Button2Size;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const VARIANT_CLASS: Record<Button2Variant, string> = {
  primary: 'bg-[var(--button2-primary-bg)] text-[var(--button2-primary-text)]',
  secondary: 'bg-[var(--button2-secondary-bg)] text-[var(--button2-secondary-text)]',
};

const SIZE_CLASS: Record<Button2Size, string> = {
  md: 'gap-[8px] px-[20px] py-[10px] text-[16px] leading-[24px] font-bold',
  xs: 'gap-[4px] px-[8px] py-[6px] text-[12px] leading-[18px] font-bold',
};

/**
 * Button2 — átomo del design system "DBoard V1.1.X" (Figma node 7217:35730,
 * variantes Primary MD / Secondary XS). No reemplaza a `Button.tsx` legado
 * (5 consumidores activos, paleta color-mix distinta) — namespace y nombre
 * propios, mismo criterio que Sidebar2/CardBase/Badge.
 */
export function Button2({
  label,
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  onClick,
  className = '',
}: Button2Props): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center whitespace-nowrap rounded-lg ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    >
      {iconLeft}
      {label}
      {iconRight}
    </button>
  );
}
