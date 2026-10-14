import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button.js';

export interface FilterOption<T> {
  label: string;
  value: T;
}

export interface FilterGroup<T> {
  label: string;
  options: Array<FilterOption<T>>;
  selected: T[];
  onChange: (value: T[]) => void;
}

interface FilterPopoverProps {
  groups: Array<FilterGroup<any>>;
  icon?: React.ReactNode;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Un botón que abre un panel de filtros —un grupo de casillas por faceta
 * (proyectos, estado), cada uno de selección múltiple—.
 *
 * Con el tema: el botón es el del sistema (`Button`, contorno) y el panel usa
 * las superficies del tema. Tenía dos paletas propias, una clara con azul y
 * una oscura con tokens del look anterior (`--button2-*`, `--sidebar2-*`) que
 * ya no existen, así que su botón salía sin fondo.
 */
export function FilterPopover({ groups, icon }: FilterPopoverProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const activeCount = groups.reduce((sum, g) => sum + g.selected.length, 0);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" className="gap-2" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="text-muted-foreground">{icon}</span>
        Filtros
        {activeCount > 0 && <span className="badge">{activeCount}</span>}
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg">
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</div>
                <div className="flex flex-col gap-1.5">
                  {group.options.map((option) => (
                    <label
                      key={String(option.value)}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        className="input"
                        checked={group.selected.includes(option.value)}
                        onChange={() => group.onChange(toggle(group.selected, option.value))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {activeCount > 0 && (
              <Button variant="link" className="self-start px-0" onClick={() => groups.forEach((g) => g.onChange([]))}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
