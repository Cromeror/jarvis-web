import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '../shell/AppShell.js';
import { EnvironmentsMenu } from './EnvironmentsMenu.js';
import { PipelinesMenu } from './PipelinesMenu.js';
import { FloatingChat } from '../Chat/FloatingChat.js';
import { WorkspaceAnchorProvider, useShellAnchorRef } from './workspace-anchor.js';

/**
 * El shell de la app, sobre el chasis del template SpaceMyWork.
 *
 * Reemplaza a `AppShellTemplate` (el shell portado de Figma): la demo adopta el
 * sistema del template entero, y dos chasis conviviendo significaría dos
 * respuestas distintas a dónde va cada cosa.
 *
 * Acá sólo se resuelve QUÉ va en cada slot; la estructura vive en AppShell,
 * donde el árbol es el contrato con el CSS.
 */

const TITULOS: Record<string, { titulo: string; sub?: string }> = {
  '': { titulo: 'Dashboard', sub: 'El estado de la flota' },
  chat: { titulo: 'Chat', sub: 'Conversaciones por proyecto' },
  plans: { titulo: 'Planes', sub: 'Lo que se ejecuta por pasos' },
  environments: { titulo: 'Environments', sub: 'Lo que cada proyecto necesita corriendo' },
  workspaces: { titulo: 'Workspaces', sub: 'Espacios de trabajo y sus cambios' },
  catalogo: { titulo: 'Catálogo', sub: 'Paquetes y módulos' },
  users: { titulo: 'Usuarios', sub: 'Quién entra y con qué permisos' },
};

function useSeccion(): { titulo: string; sub?: string } {
  const { pathname } = useLocation();
  const [, segmento] = pathname.split('/');
  return TITULOS[segmento ?? ''] ?? { titulo: 'Jarvis' };
}

export function AppLayout(): React.ReactElement {
  return (
    // El provider envuelve al shell porque el anchor por defecto ES el área de
    // contenido del shell: quien lo registra tiene que estar adentro.
    <WorkspaceAnchorProvider>
      <ShellConAnchor />
    </WorkspaceAnchorProvider>
  );
}

function ShellConAnchor(): React.ReactElement {
  const { titulo, sub } = useSeccion();
  const contentRef = useShellAnchorRef();

  return (
    <AppShell
      titulo={titulo}
      sub={sub}
      acciones={
        <>
          <EnvironmentsMenu />
          <PipelinesMenu />
        </>
      }
      contentRef={contentRef}
      chat={<FloatingChat />}
    >
      <Outlet />
    </AppShell>
  );
}
