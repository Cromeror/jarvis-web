import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar2 } from './AppSidebar2.js';
import { EnvironmentsMenu } from './EnvironmentsMenu.js';
import { PipelinesMenu } from './PipelinesMenu.js';
import { AppShellTemplate } from '../ui/templates/AppShellTemplate.js';
import { FloatingChat } from '../Chat/FloatingChat.js';

/**
 * Título de página según el primer segmento de la ruta — mismo criterio que
 * tenía TopNav.tsx (reemplazado por Topbar, ver node 6963:42 de Figma).
 */
const PAGE_TITLES: Record<string, string> = {
  '': 'Dashboard',
  'chat': 'Chat',
  'plans': 'Planes',
  'environments': 'Environments',
  'workspaces': 'Workspaces',
};

function usePageTitle(): string {
  const { pathname } = useLocation();
  const [, segment] = pathname.split('/');
  return PAGE_TITLES[segment ?? ''] ?? 'Jarvis';
}

/**
 * Wiring de ruta (título, estado del drawer mobile) sobre AppShellTemplate
 * (Figma node 7224:858, "Layout / App Shell") — la estructura visual del
 * shell vive en el template, acá solo se resuelve qué va en cada slot.
 */
export function AppLayout(): React.ReactElement {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const title = usePageTitle();

  return (
    <AppShellTemplate
      sidebar={<AppSidebar2 mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />}
      topbarTitle={title}
      topbarActions={
        <>
          <EnvironmentsMenu />
          <PipelinesMenu />
        </>
      }
      onMenuClick={() => setMobileNavOpen(true)}
    >
      <Outlet />
      {/* Va en el shell y no en cada página: el punto del chat flotante es estar
          disponible sin importar dónde estés. Él decide no dibujarse en /chat,
          que es donde sobra. */}
      <FloatingChat />
    </AppShellTemplate>
  );
}
