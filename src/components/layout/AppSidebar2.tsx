import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchNavigation } from '../../lib/catalog-api.js';
import { useActiveProjectId } from '../../hooks/useActiveProject.js';
import type { CatalogPackage } from '../../lib/catalog-api.js';
import { useCollapsible } from '../../hooks/useCollapsible.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Sidebar2, type Sidebar2NavItemData } from '../ui/organisms/Sidebar2.js';
import { AccountMenu } from './AccountMenu.js';

interface NavRoute extends Sidebar2NavItemData {
  to: string;
  end: boolean;
}

const ACCENT_ROUTE: NavRoute = { id: 'dashboard', to: '/', label: 'Dashboard', icon: 'dashboard', end: true };

/**
 * El PISO del menú: lo que está siempre, para todos.
 *
 * Chat es el piso de cualquier usuario; el resto de estas entradas son
 * herramientas del producto que hoy siguen fijas. Lo dinámico se suma a esto,
 * no lo reemplaza — un menú que pueda quedar vacío es un usuario sin forma de
 * llegar a ninguna parte.
 */
const NAV_ROUTES: NavRoute[] = [
  { id: 'chat', to: '/chat', label: 'Chat', icon: 'chat', end: false },
  { id: 'plans', to: '/plans', label: 'Planes', icon: 'plans', end: false },
  { id: 'workspaces', to: '/workspaces', label: 'Workspaces', icon: 'workspaces', end: false },
  { id: 'environments', to: '/environments', label: 'Environments', icon: 'environments', end: false },
];

/** Administración: usuarios y el catálogo del producto. Sólo el superadmin. */
const ADMIN_ROUTES: NavRoute[] = [
  { id: 'users', to: '/users', label: 'Usuarios', icon: 'users', end: false },
  { id: 'catalog', to: '/catalogo', label: 'Catálogo', icon: 'settings', end: false },
];


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

  // El proyecto activo, con su fallback al único accesible: sin eso, un usuario
  // cliente entra al Dashboard y ve el menú sin sus paquetes.
  const projectId = useActiveProjectId();
  const [packages, setPackages] = useState<CatalogPackage[]>([]);

  // Los paquetes asignados al proyecto de la URL. Un 403 o un proyecto sin
  // paquetes dejan la lista vacía y el menú se queda con su piso: el sidebar no
  // es lugar para mostrar un error de carga.
  useEffect(() => {
    if (!projectId) {
      setPackages([]);
      return;
    }
    let cancelado = false;
    void fetchNavigation(projectId)
      .then((p) => {
        if (!cancelado) setPackages(p);
      })
      .catch(() => {
        if (!cancelado) setPackages([]);
      });
    return () => {
      cancelado = true;
    };
  }, [projectId]);

  /**
   * Una entrada por paquete, con sus módulos de submenú.
   *
   * El id de cada ruta es la propia URL: los paquetes son datos, no constantes,
   * así que no hay un id estable que escribir a mano y usar el path evita
   * mantener un mapa aparte.
   */
  const packageRoutes: NavRoute[] = packages.map((pkg) => ({
    id: `/paquetes/${projectId}/${pkg.slug}`,
    to: `/paquetes/${projectId}/${pkg.slug}`,
    label: pkg.name,
    icon: 'workspaces',
    end: false,
    children: pkg.modules.map((mod) => ({
      id: `/paquetes/${projectId}/${pkg.slug}/${mod.slug}`,
      label: mod.name,
      icon: 'plans',
    })),
  }));

  const routes =
    user?.account_type === 'operator'
      ? [...NAV_ROUTES, ...packageRoutes, ...ADMIN_ROUTES]
      : [...NAV_ROUTES, ...packageRoutes];
  const allRoutes = [ACCENT_ROUTE, ...routes];
  // El módulo activo gana sobre su paquete: los dos matchean por prefijo, y con
  // el paquete primero un módulo abierto nunca se vería seleccionado.
  const moduloActivo = packageRoutes
    .flatMap((r) => r.children ?? [])
    .find((child) => location.pathname === child.id);
  const activeRoute =
    allRoutes.find((route) => (route.end ? location.pathname === route.to : location.pathname.startsWith(route.to)));

  const handleSelect = (id: string): void => {
    const route = allRoutes.find((r) => r.id === id);
    // Los sub-ítems (módulos) no están en `allRoutes`: su id ES su path, así que
    // navegar a él alcanza y no hace falta aplanar el árbol para buscarlos.
    navigate(route ? route.to : id);
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
          activeId={moduloActivo?.id ?? activeRoute?.id}
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
