import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { PipelinesMenu } from './PipelinesMenu.js';

const linkBase =
  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors';
const linkActive = 'bg-indigo-50 text-indigo-700';
const linkInactive = 'text-slate-500 hover:bg-slate-100 hover:text-slate-700';

export function TopNav(): React.ReactElement {
  const { projectId } = useParams<{ projectId?: string }>();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4">
      <NavLink
        to="/"
        end
        className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-semibold text-white"
      >
        J
      </NavLink>
      <nav className="flex items-center gap-1">
        <NavLink
          to="/context-graph"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          Grafo de conocimiento
        </NavLink>
        <NavLink
          to="/plans"
          className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
        >
          Planes
        </NavLink>
      </nav>
      <PipelinesMenu projectId={projectId ?? null} />
    </header>
  );
}
