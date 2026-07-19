import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCollapsible } from '../../hooks/useCollapsible.js';

const itemBase =
  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors';
const itemActive = 'bg-indigo-600 text-white shadow-sm';
const itemInactive = 'text-slate-500 hover:bg-slate-100 hover:text-slate-700';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'pi-th-large', end: true },
  { to: '/plans', label: 'Planes', icon: 'pi-list-check', end: false },
  { to: '/chat', label: 'Chat', icon: 'pi-comments', end: false },
  { to: '/environments', label: 'Environments', icon: 'pi-server', end: false },
] as const;

export function SideNav({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}): React.ReactElement {
  const [collapsed, toggle] = useCollapsible('sidenav');

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white py-4 px-3 transition-transform duration-200 md:relative md:translate-x-0 md:transition-[width] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-16 md:px-2' : 'md:w-56 md:px-3'}`}
      >
        <div className={`mb-6 flex items-center gap-2 px-2 ${collapsed ? 'md:justify-center' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
            J
          </div>
          <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
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
              onClick={onMobileClose}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `${itemBase} ${isActive ? itemActive : itemInactive} ${collapsed ? 'md:justify-center md:px-0' : ''}`
              }
            >
              <i className={`pi ${icon} text-base`} />
              <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <a
            href="https://github.com/anthropics/claude-code/issues"
            target="_blank"
            rel="noreferrer"
            title={collapsed ? 'Soporte' : undefined}
            className={`${itemBase} ${itemInactive} ${collapsed ? 'md:justify-center md:px-0' : ''}`}
          >
            <i className="pi pi-question-circle text-base" />
            <span className={collapsed ? 'md:hidden' : ''}>Soporte</span>
          </a>
        </div>

        <button
          type="button"
          onClick={toggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="absolute -right-3 top-6 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 md:flex"
        >
          <i className={`pi ${collapsed ? 'pi-angle-right' : 'pi-angle-left'} text-xs`} />
        </button>

        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Cerrar menú"
          className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
        >
          <i className="pi pi-times text-base" />
        </button>
      </aside>
    </>
  );
}
