import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCollapsible } from '../../hooks/useCollapsible.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Sidebar2, type Sidebar2NavItemData } from '../ui/organisms/Sidebar2.js';
import { AccountMenu } from './AccountMenu.js';

interface NavRoute extends Sidebar2NavItemData {
  to: string;
  end: boolean;
}

const ACCENT_ROUTE: NavRoute = { id: 'dashboard', to: '/', label: 'Dashboard', icon: 'dashboard', end: true };

const NAV_ROUTES: NavRoute[] = [
  { id: 'chat', to: '/chat', label: 'Chat', icon: 'chat', end: false },
  { id: 'plans', to: '/plans', label: 'Planes', icon: 'plans', end: false },
  { id: 'environments', to: '/environments', label: 'Environments', icon: 'environments', end: false },
];

const USERS_ROUTE: NavRoute = { id: 'users', to: '/users', label: 'Usuarios', icon: 'users', end: false };

/**
 * Reemplaza a SideNav como el rail de navegación global (Sidebar2, portado
 * de Figma). Mismo key 'sidenav' en useCollapsible a propósito — conserva
 * la preferencia de collapse que el usuario ya tenía guardada. `AccountMenu`
 * vive acá (footer, absolute) y no en `Topbar` — el frame de Figma del
 * Topbar no lo incluye, y el usuario pidió explícitamente moverlo al
 * sidebar en vez de perder acceso a cuenta/logout.
 */
export function AppSidebar2({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}): React.ReactElement {
  const [collapsed, toggle] = useCollapsible('sidenav');
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const routes = user?.role === 'superadmin' ? [...NAV_ROUTES, USERS_ROUTE] : NAV_ROUTES;
  const allRoutes = [ACCENT_ROUTE, ...routes];
  const activeRoute = allRoutes.find((route) =>
    route.end ? location.pathname === route.to : location.pathname.startsWith(route.to)
  );

  const handleSelect = (id: string): void => {
    const route = allRoutes.find((r) => r.id === id);
    if (route) navigate(route.to);
    onMobileClose();
  };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onMobileClose} />}

      <aside
        // p-3 solo aplica en mobile (drawer fixed, breathing room propio para
        // el botón de cerrar) — en desktop se cancela con md:p-0: el gap/padding
        // de 8px entre sidebar y contenido ya lo da AppShellTemplate (Figma
        // node 7224:858), sumarle el p-3 acá duplicaría ese espacio.
        className={`fixed inset-y-0 left-0 z-40 h-full shrink-0 p-3 transition-transform duration-200 md:relative md:translate-x-0 md:p-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar2
          collapsed={collapsed && !mobileOpen}
          accentItem={ACCENT_ROUTE}
          items={routes}
          secondaryItems={[]}
          activeId={activeRoute?.id}
          onSelect={handleSelect}
        />

        <div className="absolute inset-x-3 bottom-3 flex justify-center">
          <AccountMenu />
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
          className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 md:hidden"
        >
          <i className="pi pi-times text-base" />
        </button>
      </aside>
    </>
  );
}
