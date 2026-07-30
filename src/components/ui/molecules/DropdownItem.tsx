import React from 'react';

interface DropdownItemProps {
  label: string;
  selected?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * DropdownItem — fila del menú de Dropdown (Figma node 2683:125159, sub-
 * componente "Items"). El ícono derecho (candado) del export de Figma era
 * un placeholder decorativo sin significado propio en cada fila — no se
 * generaliza como slot; el ícono izquierdo sí, porque identifica la opción.
 */
export function DropdownItem({
  label,
  selected = false,
  icon,
  onClick,
  className = '',
}: DropdownItemProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-[8px] border-b border-[var(--dropdown-border)] px-[16px] py-[8px] text-left text-[16px] leading-[24px] last:border-b-0 ${
        selected
          ? 'bg-[var(--dropdown-surface-selected)] text-[var(--dropdown-text-on-selected)]'
          : 'bg-[var(--dropdown-surface)] text-[var(--dropdown-text)]'
      } ${className}`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
