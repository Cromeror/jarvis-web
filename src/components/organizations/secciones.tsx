import React, { useState } from 'react';
import { OrganizationRolesPanel } from './OrganizationRolesPanel.js';
import { OrganizationPortsSection } from './OrganizationPortsSection.js';
import { OrganizationRedContextoSection } from './OrganizationRedContextoSection.js';
import { CrearMiembro } from './CrearMiembro.js';
import type { SeccionDeOrganizacion } from './secciones-visibles.js';

/**
 * Las secciones de «Mi organización», indexadas por la `key` del módulo de
 * ORGANIZACIÓN que las trae.
 *
 * Es la mitad del front de `ORGANIZATION_MODULES` (registro del core), igual que
 * `MODULE_VIEWS` lo es de `CLIENT_MODULES`: el backend dice qué módulos de
 * organización tiene la organización; esto dice qué se dibuja por cada uno.
 *
 * Una sección se muestra si la organización TIENE el módulo (viene en una suite
 * de alguno de sus proyectos) y quien mira tiene AL MENOS UNO de sus permisos.
 * Los dos ejes de siempre: la suite decide visibilidad, el rol autoridad. Sin el
 * permiso la sección ni se monta, porque su primer pedido daría 403.
 *
 * Una `key` que el servidor devuelva y no esté acá se ignora: es un módulo más
 * nuevo que este bundle.
 */
export const SECCIONES_DE_ORGANIZACION: Record<string, SeccionDeOrganizacion<React.ReactNode>> = {
  'miembros-006': {
    permisos: ['miembros-006:roles', 'miembros-006:members', 'miembros-006:create'],
    render: (organizationId, permisos) => <SeccionMiembros organizationId={organizationId} permisos={permisos} />,
  },
  'puertos-005': {
    permisos: ['puertos-005:manage'],
    render: (organizationId) => <OrganizationPortsSection organizationId={organizationId} />,
  },
  'red-de-contexto-org-007': {
    permisos: ['red-de-contexto-org-007:manage'],
    render: (organizationId) => <OrganizationRedContextoSection organizationId={organizationId} />,
  },
};

/**
 * Roles y miembros, más el alta de usuarios si el permiso lo deja.
 *
 * Sin `users`: la lista de usuarios de la instalación es del operador. El
 * administrador de la organización suma gente CREÁNDOLA, y a la que ya es suya
 * le cambia el rol en su fila. Crear remonta el panel para que el nuevo
 * aparezca en la tabla de miembros, sin rol.
 */
function SeccionMiembros({ organizationId, permisos }: { organizationId: string; permisos: readonly string[] }): React.ReactElement {
  const [version, setVersion] = useState(0);
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-white">Miembros y roles</h2>
      <OrganizationRolesPanel key={version} users={[]} organizacionFija={organizationId} />
      {permisos.includes('miembros-006:create') && (
        <CrearMiembro organizationId={organizationId} onCreado={() => setVersion((v) => v + 1)} />
      )}
    </section>
  );
}
