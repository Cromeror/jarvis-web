import React from 'react';
import { useCollapsible } from '../../hooks/useCollapsible.js';

const itemBase =
  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors';
const itemInactive = 'text-slate-500 hover:bg-slate-100 hover:text-slate-700';
const itemActive = 'bg-indigo-50 text-indigo-700';

// Rail de opciones del chat — pensado para crecer; hoy solo "Planes".
const OPTIONS = [{ key: 'plans', label: 'Planes', icon: 'pi-list-check' }] as const;

interface ChatOptionsRailProps {
  /** Opción cuyo panel está abierto (o null). */
  activeOption: string | null;
  /** Alterna la opción — el caller decide abrir/cerrar el panel asociado. */
  onToggleOption: (key: string) => void;
}

/**
 * Right-side options rail for the chat, desktop-only (`hidden md:flex`). Same
 * collapse mechanics as SideNav (useCollapsible, persisted per key) but mirrored
 * to the right edge: border on the left, toggle handle on the inner (left) side.
 */
export function ChatOptionsRail({ activeOption, onToggleOption }: ChatOptionsRailProps): React.ReactElement {
  const [collapsed, toggle] = useCollapsible('chat-options-rail');

  return (
    <aside
      className={`relative hidden h-full shrink-0 flex-col border-l border-slate-200 bg-white py-4 transition-[width] duration-200 md:flex ${
        collapsed ? 'md:w-16 md:px-2' : 'md:w-56 md:px-3'
      }`}
    >
      <nav className="flex flex-1 flex-col gap-1">
        {OPTIONS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onToggleOption(key)}
            title={collapsed ? label : undefined}
            className={`${itemBase} ${key === activeOption ? itemActive : itemInactive} ${collapsed ? 'md:justify-center md:px-0' : ''}`}
          >
            <i className={`pi ${icon} text-base`} />
            <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Expandir opciones' : 'Colapsar opciones'}
        className="absolute -left-3 top-6 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 md:flex"
      >
        <i className={`pi ${collapsed ? 'pi-angle-left' : 'pi-angle-right'} text-xs`} />
      </button>
    </aside>
  );
}
