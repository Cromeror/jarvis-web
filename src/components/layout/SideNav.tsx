import React from 'react';
import { NavLink } from 'react-router-dom';

const itemBase =
  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors';
const itemActive = 'bg-indigo-600 text-white shadow-sm';
const itemInactive = 'text-slate-500 hover:bg-slate-100 hover:text-slate-700';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'pi-th-large', end: true },
  { to: '/context-graph', label: 'Grafo de conocimiento', icon: 'pi-sitemap', end: false },
  { to: '/plans', label: 'Planes', icon: 'pi-list-check', end: false },
  { to: '/chat', label: 'Chat', icon: 'pi-comments', end: false },
] as const;

export function SideNav(): React.ReactElement {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
          J
        </div>
        <div>
          <div className="text-sm font-semibold leading-none text-slate-900">Jarvis</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Portal</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemInactive}`}
          >
            <i className={`pi ${icon} text-base`} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <a
          href="https://github.com/anthropics/claude-code/issues"
          target="_blank"
          rel="noreferrer"
          className={`${itemBase} ${itemInactive}`}
        >
          <i className="pi pi-question-circle text-base" />
          Soporte
        </a>
      </div>
    </aside>
  );
}
