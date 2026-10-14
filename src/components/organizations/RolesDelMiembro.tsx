import React from 'react';
import type { RoleSummary } from '../../lib/organizations-api.js';

/**
 * LOS ROLES DE UNA PERSONA EN SU ORGANIZACIÓN, editables en la celda.
 *
 * Vive aparte porque lo usan dos tablas: «Usuarios de la organización» (la
 * pantalla del operador) y «Miembros» (Ajustes → Organización). Son la misma
 * gente —una fila de `organization_members`— y el rol se edita igual en las dos.
 *
 * UN TOGGLE POR ROL, no un `<select multiple>`. Los permisos de un miembro son
 * la UNIÓN de sus roles, así que lo que hay que poder leer de un vistazo es
 * cuáles tiene — y un multi-select nativo esconde eso detrás de un scroll y de
 * un Ctrl+clic que nadie descubre. Acá cada rol es un chip: encendido = lo tiene.
 *
 * SÓLO LOS DE ORGANIZACIÓN. Este eje no otorga nada sobre proyectos, así que
 * ofrecer acá un rol `scope: project` es ofrecer algo que se guarda bien y no
 * hace nada. Pasó: «Colaborador» (que lleva `project:read`) puesto acá en vez
 * de en el proyecto, y la suite nunca apareció. La API lo rechaza también
 * (`RoleNotForOrganizationAxisError`); esto es para que no se pueda ni intentar.
 */
export function RolesDelMiembro({
  roles,
  asignados,
  editable,
  onCambiar,
}: {
  /** Todos los roles de la organización; se ofrecen sólo los de organización. */
  roles: RoleSummary[];
  asignados: Array<{ role_id: string; role_name: string | null }>;
  editable: boolean;
  /** El conjunto COMPLETO que queda: el guardado es un reemplazo. */
  onCambiar: (roleIds: string[]) => void;
}): React.ReactElement {
  const deOrganizacion = roles.filter((r) => r.scope === 'org');
  const ids = new Set(asignados.map((r) => r.role_id));
  const alternar = (roleId: string): void => {
    const siguiente = new Set(ids);
    if (siguiente.has(roleId)) siguiente.delete(roleId);
    else siguiente.add(roleId);
    onCambiar([...siguiente]);
  };
  /* Lo que está asignado pero NO se ofrece: un rol borrado por debajo, o uno de
     proyecto que quedó colgado de acá antes de que esto se filtrara. Se muestra
     igual —desaparecer sin decirlo dejaría una fila que nadie puede limpiar— y
     se puede sacar con un clic. */
  const colgados = asignados.filter((r) => !deOrganizacion.some((x) => x.id === r.role_id));
  return (
    <div className="flex flex-wrap gap-1 py-1 whitespace-normal">
      {deOrganizacion.map((r) => {
        const activo = ids.has(r.id);
        return (
          <button
            key={r.id}
            type="button"
            disabled={!editable}
            onClick={() => alternar(r.id)}
            aria-pressed={activo}
            title={activo ? `Sacarle «${r.name}»` : `Darle «${r.name}»`}
            className={`rounded-full border px-2 py-0.5 text-[11px] disabled:opacity-40 ${
              activo
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.name}
          </button>
        );
      })}
      {colgados.map((r) => {
        const deProyecto = roles.find((x) => x.id === r.role_id);
        return (
          <button
            key={r.role_id}
            type="button"
            disabled={!editable}
            onClick={() => alternar(r.role_id)}
            title={
              deProyecto
                ? `«${deProyecto.name}» es un rol de proyecto: acá no otorga nada. Sacalo y asignalo en el proyecto.`
                : 'Este rol ya no existe. Clic para sacarlo.'
            }
            className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-600 disabled:opacity-40"
          >
            {r.role_name ?? '(rol desconocido)'} ✕
          </button>
        );
      })}
      {/* Pertenecer sin roles es un estado real y el que más confunde: la
          persona entra y no puede nada. Se dice, no se deja en blanco. */}
      {asignados.length === 0 ? <span className="text-[11px] text-muted-foreground">Sin roles — no puede nada</span> : null}
      {/* Sin roles de organización no hay nada que ofrecer, y el vacío se lee
          como un bug de la pantalla si no se dice por qué. */}
      {deOrganizacion.length === 0 ? (
        <span className="text-[11px] text-muted-foreground">Esta organización no tiene roles de organización</span>
      ) : null}
    </div>
  );
}
