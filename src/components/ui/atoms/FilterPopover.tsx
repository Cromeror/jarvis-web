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

interface FilterPopoverProps {
  groups: Array<FilterGroup<any>>;
  icon?: React.ReactNode;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Single pill button that opens a Jira-style filter panel — one checkbox
 * group per facet (e.g. Projects, Status), each independently multi-select.
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-transparent bg-slate-50 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
      >
        <span className="text-slate-400">{icon}</span>
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.options.map((option) => (
                    <label
                      key={String(option.value)}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={group.selected.includes(option.value)}
                        onChange={() => group.onChange(toggle(group.selected, option.value))}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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
              className="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
