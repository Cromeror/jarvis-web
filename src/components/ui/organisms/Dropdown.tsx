import React, { useEffect, useRef, useState } from 'react';
import { DropdownTrigger, type DropdownVariant } from '../molecules/DropdownTrigger.js';
import { DropdownItem } from '../molecules/DropdownItem.js';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  variant?: DropdownVariant;
  className?: string;
}

/**
 * Dropdown — organismo completo (Figma node 2683:125159, frame "Dropdown"):
 * Trigger + menú de opciones, mismas 4 variantes de color
 * (Neutral/Primary/Secondary/Tertiary). Click-outside sigue el mismo patrón
 * que FilterPopover (ref + listener de mousedown en document, activo solo
 * mientras el menú está abierto). El menú usa scroll nativo
 * (max-height + overflow-y-auto) en vez de la scrollbar decorativa y
 * estática del export de Figma — una barra que no scrollea de verdad no
 * aporta nada funcional acá.
 */
export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Placeholder',
  variant = 'Secondary',
  className = '',
}: DropdownProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <DropdownTrigger
        label={selectedOption?.label ?? placeholder}
        variant={variant}
        open={open}
        onClick={() => setOpen((current) => !current)}
      />
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 max-h-[200px] w-full overflow-y-auto rounded-lg border border-[var(--dropdown-border)] bg-[var(--dropdown-surface)]">
          {options.map((option) => (
            <DropdownItem
              key={option.value}
              label={option.label}
              icon={option.icon}
              selected={option.value === value}
              onClick={() => {
                onChange?.(option.value);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
