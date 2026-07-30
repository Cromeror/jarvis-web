import React from 'react';
import { DropdownIcon } from '../atoms/DropdownIcon.js';

export type DropdownVariant = 'Neutral' | 'Primary' | 'Secondary' | 'Tertiary';

interface DropdownTriggerProps {
  label: string;
  variant?: DropdownVariant;
  open?: boolean;
  onClick?: () => void;
  className?: string;
}

const VARIANT_CLASS: Record<DropdownVariant, string> = {
  Neutral:
    'border border-[var(--dropdown-neutral-border)] bg-[var(--dropdown-neutral-bg)] font-bold text-[var(--dropdown-neutral-text)]',
  Primary: 'bg-[var(--dropdown-primary-bg)] font-bold text-[var(--dropdown-primary-text)]',
  Secondary: 'bg-[var(--dropdown-secondary-bg)] font-bold text-[var(--dropdown-secondary-text)]',
  Tertiary:
    'bg-gradient-to-r from-[var(--dropdown-tertiary-from)] via-[var(--dropdown-tertiary-via)] to-[var(--dropdown-tertiary-to)] font-semibold text-[var(--dropdown-tertiary-text)]',
};

/**
 * DropdownTrigger — botón disparador de Dropdown (Figma node 2683:125159,
 * sub-frame "Trigger"). A diferencia de Button2 (íconos agrupados al
 * centro), el label ocupa flex-1 para que el chevron quede siempre pegado
 * al borde derecho — layout propio del Trigger, por eso no se reusa Button2
 * acá aunque comparta paleta primary/secondary. El peso de fuente varía por
 * variante porque así está en Figma: bold en Neutral/Primary/Secondary,
 * semibold en Tertiary.
 */
export function DropdownTrigger({
  label,
  variant = 'Secondary',
  open = false,
  onClick,
  className = '',
}: DropdownTriggerProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`flex w-full items-center gap-[8px] rounded-lg px-[20px] py-[10px] text-[16px] leading-[24px] ${VARIANT_CLASS[variant]} ${className}`}
    >
      <DropdownIcon icon="user" size={20} />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <DropdownIcon icon={open ? 'chevron-up' : 'chevron-down'} size={20} />
    </button>
  );
}
