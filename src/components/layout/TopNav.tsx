import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { PipelinesMenu } from './PipelinesMenu.js';
import { EnvironmentsMenu } from './EnvironmentsMenu.js';
import { AccountMenu } from './AccountMenu.js';

/**
 * Page title shown on the left, keyed by the first path segment — mirrors
 * the routes declared in App.tsx. Falls back to the Jarvis brand name for
 * routes with no obvious page title (e.g. project map, editor).
 */
const PAGE_TITLES: Record<string, string> = {
  '': 'Dashboard',
  'chat': 'Chat',
  'plans': 'Planes',
  'environments': 'Environments',
};

function usePageTitle(): string {
  const { pathname } = useLocation();
  const [, segment] = pathname.split('/');
  return PAGE_TITLES[segment ?? ''] ?? 'Jarvis';
}

export function TopNav({ onMenuClick }: { onMenuClick: () => void }): React.ReactElement {
  const title = usePageTitle();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-900 px-5 text-white">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menú"
        className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
      >
        <i className="pi pi-bars text-lg" />
      </button>

      <h1 className="shrink-0 text-lg font-semibold">{title}</h1>

      <div className="mx-auto w-full max-w-md">
        <IconField iconPosition="left">
          <InputIcon className="pi pi-search" />
          <InputText
            placeholder="Buscar…"
            className="w-full rounded-lg! border-0! bg-slate-800! py-2! text-sm! text-white! placeholder:text-slate-400!"
          />
        </IconField>
      </div>

      <nav className="hidden items-center gap-1 md:flex">
        {/* nav links aqui */}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <EnvironmentsMenu />
        <PipelinesMenu />
        <AccountMenu />
      </div>
    </header>
  );
}
