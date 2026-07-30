import React from 'react';

interface TopbarProps {
  title: string;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
  className?: string;
}

/**
 * Topbar — organismo del design system "DBoard V1.1.X" (Figma node 6963:42).
 * Reemplaza a layout/TopNav.tsx en AppLayout — mismo criterio que
 * Sidebar→Sidebar2. `actions` es un slot genérico (EnvironmentsMenu +
 * PipelinesMenu re-skineados con TopbarIconButton) — Topbar no sabe qué hay
 * ahí, igual que ChatOptionsRail no sabe qué panel abre cada nav item.
 * Search bar estática (sin wiring) — TopNav tampoco lo tenía funcional. La
 * lupa de Figma es un cuadrado sólido sin ícono real (placeholder) — se usa
 * `pi-search` (PrimeIcons, ya usado por TopNav) en vez de reproducir el
 * cuadrado. `onMenuClick` no viene del frame (que es desktop-only, 1344px
 * fijo) — se agrega para no perder la forma de abrir el drawer del sidebar
 * en mobile que sí tenía TopNav.
 */
export function Topbar({ title, searchPlaceholder = 'Buscar...', actions, onMenuClick, className = '' }: TopbarProps): React.ReactElement {
  return (
    <div
      className={`flex h-[59px] w-full shrink-0 items-center gap-4 justify-between border border-[var(--topbar-border)] bg-[var(--topbar-bg)] pl-[var(--topbar-padding-left)] pr-[var(--topbar-padding-right)] rounded-t-[var(--topbar-radius-top)] ${className}`}
    >
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--topbar-text-secondary)] hover:bg-white/10 md:hidden"
        >
          <i className="pi pi-bars text-lg" />
        </button>
      )}

      <p className="shrink-0 whitespace-nowrap text-[20px] font-semibold text-[var(--topbar-text-secondary)]">{title}</p>

      <div className="flex h-[38px] w-[400px] shrink-0 items-center gap-[var(--topbar-gap)] rounded-[var(--topbar-radius)] border border-[var(--topbar-border)] bg-[var(--topbar-searchbar-bg)] px-[var(--topbar-searchbar-pad-h)]">
        <i className="pi pi-search text-[13px] text-[var(--topbar-text-secondary)]" />
        <p className="text-[13px] text-[var(--topbar-text-secondary)]">{searchPlaceholder}</p>
      </div>

      <div className="flex shrink-0 items-center gap-[var(--topbar-gap)]">{actions}</div>
    </div>
  );
}
