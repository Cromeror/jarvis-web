import React from 'react';
import { Dropdown } from 'primereact/dropdown';

export interface PillDropdownOption<T> {
  label: string;
  value: T;
}

interface PillDropdownProps<T> {
  value: T;
  options: Array<PillDropdownOption<T>>;
  onChange: (value: T) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

const pillClass =
  'rounded-full border border-transparent bg-slate-50 [&_.p-dropdown-label]:py-2 [&_.p-dropdown-label]:pl-1 [&_.p-dropdown-label]:pr-0 [&_.p-dropdown-label]:text-sm [&_.p-dropdown-label]:font-medium [&_.p-dropdown-label]:text-slate-900 [&_.p-dropdown-trigger]:hidden';

/** Pill-shaped filter/sort dropdown — generic over option value type, no domain knowledge. */
export function PillDropdown<T>({ value, options, onChange, placeholder, icon }: PillDropdownProps<T>): React.ReactElement {
  return (
    <Dropdown
      value={value}
      options={options}
      onChange={(e) => onChange(e.value as T)}
      placeholder={placeholder}
      className={pillClass}
      pt={{ root: { className: 'px-4' } }}
      {...(icon
        ? {
            valueTemplate: (option: PillDropdownOption<T> | undefined) => (
              <span className="flex items-center gap-2">
                <span className="text-slate-400">{icon}</span>
                {option?.label ?? placeholder}
              </span>
            ),
          }
        : {})}
    />
  );
}
