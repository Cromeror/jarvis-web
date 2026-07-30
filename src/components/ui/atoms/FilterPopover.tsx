import React, { useEffect, useRef, useState } from 'react';

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

export type FilterPopoverVariant = 'light' | 'dark';

interface FilterPopoverProps {
  groups: Array<FilterGroup<any>>;
  icon?: React.ReactNode;
  /** Default 'light' — mismo look que ya tenían Planes/Environments. 'dark' es para DashboardPage (tema oscuro "DBoard V1.1.X"), reusa sus tokens (--button2-secondary-bg, --table2-*, --sidebar2-accent-default) en vez de slate/indigo. */
  variant?: FilterPopoverVariant;
}

const TRIGGER_CLASS: Record<FilterPopoverVariant, string> = {
  light: 'border-transparent bg-slate-50 text-slate-900 hover:bg-slate-100',
  dark: 'border-transparent bg-[var(--button2-secondary-bg)] text-white hover:bg-white/10',
};

const ICON_CLASS: Record<FilterPopoverVariant, string> = {
  light: 'text-slate-400',
  dark: 'text-[var(--card-text-secondary)]',
};

const BADGE_CLASS: Record<FilterPopoverVariant, string> = {
  light: 'bg-indigo-600 text-white',
  dark: 'bg-[var(--sidebar2-accent-default)] text-white',
};

const PANEL_CLASS: Record<FilterPopoverVariant, string> = {
  light: 'border-slate-200 bg-white',
  dark: 'border-[var(--table2-border)] bg-[var(--table2-header-bg)]',
};

const GROUP_LABEL_CLASS: Record<FilterPopoverVariant, string> = {
  light: 'text-slate-400',
  dark: 'text-[var(--card-text-secondary)]',
};

const OPTION_CLASS: Record<FilterPopoverVariant, string> = {
  light: 'text-slate-700 hover:bg-slate-50',
  dark: 'text-white hover:bg-white/5',
};

const CHECKBOX_CLASS: Record<FilterPopoverVariant, string> = {
  light: 'border-slate-300 text-indigo-600 focus:ring-indigo-500',
  dark: 'border-white/20 bg-transparent text-[var(--sidebar2-accent-default)] focus:ring-[var(--sidebar2-accent-default)]',
};

const CLEAR_CLASS: Record<FilterPopoverVariant, string> = {
  light: 'text-indigo-600 hover:text-indigo-700',
  dark: 'text-[var(--sidebar2-accent-default)] hover:text-white',
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Single pill button that opens a Jira-style filter panel — one checkbox
 * group per facet (e.g. Projects, Status), each independently multi-select.
 */
export function FilterPopover({ groups, icon, variant = 'light' }: FilterPopoverProps): React.ReactElement {
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${TRIGGER_CLASS[variant]}`}
      >
        <span className={ICON_CLASS[variant]}>{icon}</span>
        Filters
        {activeCount > 0 && (
          <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${BADGE_CLASS[variant]}`}>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border p-4 shadow-lg ${PANEL_CLASS[variant]}`}>
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.label}>
                <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${GROUP_LABEL_CLASS[variant]}`}>
                  {group.label}
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.options.map((option) => (
                    <label
                      key={String(option.value)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm ${OPTION_CLASS[variant]}`}
                    >
                      <input
                        type="checkbox"
                        checked={group.selected.includes(option.value)}
                        onChange={() => group.onChange(toggle(group.selected, option.value))}
                        className={`h-3.5 w-3.5 rounded ${CHECKBOX_CLASS[variant]}`}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => groups.forEach((g) => g.onChange([]))}
              className={`mt-3 text-xs font-medium ${CLEAR_CLASS[variant]}`}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
