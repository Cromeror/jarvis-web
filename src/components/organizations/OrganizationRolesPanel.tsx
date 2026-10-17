import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createRole,
  deleteRole,
  fetchPermissionCatalog,
  listMembers,
  listOrganizations,
  listRoles,
  removeMember,
  setMemberRoles,
  updateRole,
} from '../../lib/organizations-api.js';
import type {
  OrganizationMember,
  OrganizationSummary,
  PermissionInfo,
  RoleScope,
  RoleSummary,
} from '../../lib/organizations-api.js';
import { mensajeDeError } from './errores.js';
import { Tabla, type ColumnaDeTabla } from '../ui/Tabla.js';
import { RolesDelMiembro } from './RolesDelMiembro.js';
import { Dialogo } from '../ui/Dialogo.js';
import { PermisosCompactos } from './PermisosCompactos.js';
import { listModules } from '../../lib/catalog-api.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import { Icon } from '../Icon.js';
import { Button } from '../ui/atoms/Button.js';

/**
 * Controles que van directo sobre la página, que es oscura (`--app-bg`).
 * Son dos clases y no una porque son dos superficies: un input claro sobre el
 * fondo oscuro —o uno oscuro dentro del modal blanco— se lee mal en el otro.
 */
interface RoleFormState {
  name: string;
  description: string;
  scope: RoleScope;
  permissions: string[];
}

function RoleFormModal({
  organizationId,
  catalog,
  editing,
  onClose,
  onSaved,
}: {
  organizationId: string;
  catalog: PermissionInfo[];
  editing: RoleSummary | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const [form, setForm] = useState<RoleFormState>(
    editing
      ? {
          name: editing.name,
          description: editing.description ?? '',
          scope: editing.scope,
          permissions: [...editing.permissions],
        }
      : { name: '', description: '', scope: 'project', permissions: [] },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function togglePermission(permission: string): void {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(permission)
        ? f.permissions.filter((p) => p !== permission)
        : [...f.permissions, permission],
    }));
  }

  async function handleSubmit(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      if (!form.name.trim()) throw new Error('El rol necesita un nombre');
      if (editing) {
        await updateRole(organizationId, editing.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          permissions: form.permissions,
        });
      } else {
        await createRole(organizationId, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          scope: form.scope,
          permissions: form.permissions,
        });
      }
      onSaved();
    } catch (err) {
      setError(mensajeDeError(err, 'Error al guardar el rol'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialogo
      abierto
      onCerrar={onClose}
      titulo={editing ? 'Editar rol' : 'Nuevo rol'}
      onSubmit={() => void handleSubmit()}
      ancho={600}
      pie={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <div className="rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-xs text-[var(--sw-on-error)]">
            {error}
          </div>
        )}

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Nombre</span>
          <input
            type="text"
            className="input w-full"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Lector, Operador, Administrador…"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Descripción</span>
          <input
            type="text"
            className="input w-full"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Alcance</span>
          <select
            className="select w-full"
            value={form.scope}
            disabled={!!editing}
            onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as RoleScope }))}
          >
            <option value="project">Por proyecto — se asigna en un proyecto puntual</option>
            <option value="org">De organización — vale en todos sus proyectos</option>
          </select>
          <span className="text-[11px] text-muted-foreground">
            Los permisos SUMAN: el rol de organización es un piso que un rol de proyecto no puede recortar.
          </span>
        </label>

        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Permisos</span>
          {/* Con scroll propio: el catálogo es largo y el modal tiene que dejar
              ver el pie con «Guardar» sin bajar hasta el final. */}
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {catalog.map((p) => (
              <label key={p.permission} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  className="input mt-0.5"
                  checked={form.permissions.includes(p.permission)}
                  onChange={() => togglePermission(p.permission)}
                />
                <span>
                  <span className="font-mono text-xs text-foreground">{p.permission}</span>
                  {p.governance && (
                    <span className="badge ml-1" data-variant="warning">
                      gobierno
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground">{p.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Dialogo>
  );
}

/** «7 roles · 2 de organización · 5 de proyecto»: el resumen del acordeón contraído. */
function resumenDeRoles(roles: RoleSummary[]): string {
  if (roles.length === 0) return 'ninguno todavía';
  const org = roles.filter((r) => r.scope === 'org').length;
  const partes = [`${roles.length} ${roles.length === 1 ? 'rol' : 'roles'}`];
  if (org) partes.push(`${org} de organización`);
  if (roles.length - org) partes.push(`${roles.length - org} de proyecto`);
  return partes.join(' · ');
}

/**
 * Configuración de roles y miembros de una organización.
 *
 * Es la segunda mitad de la misma pantalla que la tabla de usuarios: el alta
 * dice QUIÉN entra y esto dice QUÉ puede hacer. Estaban en dos pestañas y la
 * separación costaba caro — desde "Usuarios" no se veía a qué organización
 * pertenecía cada uno, que es el dato con el que se decide.
 *
 * El alta de organizaciones NO vive acá: el botón está en la cabecera de la
 * página, junto al de nuevo usuario. Acá sólo se configura la ya elegida.
 */
export function OrganizationRolesPanel({
  organizacionFija,
  sinMiembros = false,
  onRolesChanged,
}: {
  /**
   * Sin la tabla «Miembros»: la página de Usuarios ya muestra a esa misma gente
   * —con sus roles editables— en «Usuarios de la organización». Dos tablas con
   * las mismas filas hacían preguntar si eran cosas distintas.
   */
  sinMiembros?: boolean;
  /** Avisar que los roles cambiaron: quien muestra los chips de roles en otra tabla los recarga. */
  onRolesChanged?: () => void;
  /**
   * La organización que se configura. La elige quien monta el panel —la barra
   * de Usuarios, o la organización de Ajustes—; el panel no tiene selector.
   */
  organizacionFija: string;
}): React.ReactElement {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PermissionInfo[]>([]);
  /* Los nombres de los módulos, para los chips de permisos. El catálogo entero
     es sólo del operador; si no se puede (un cliente en Ajustes), alcanzan los
     módulos de las suites del espacio activo. Lo que no tenga nombre muestra su
     código, que igual lo identifica. */
  const { suites } = useActiveProject();
  const [modulosDelCatalogo, setModulosDelCatalogo] = useState<Array<{ key: string | null; name: string }>>([]);
  useEffect(() => {
    void listModules()
      .then(setModulosDelCatalogo)
      .catch(() => setModulosDelCatalogo([]));
  }, []);
  const nombresDeModulo = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of [...suites.flatMap((s) => s.modules), ...modulosDelCatalogo]) if (x.key) m.set(x.key, x.name);
    return m;
  }, [suites, modulosDelCatalogo]);
  const descripciones = useMemo(() => new Map(catalog.map((p) => [p.permission, p.description])), [catalog]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * Que la LISTA no se haya podido cargar es distinto de que esté vacía, y hay
   * que mostrarlo distinto: renderizar "no hay organizaciones" cuando en
   * realidad el pedido falló esconde la causa — que es lo único que sirve para
   * arreglarlo.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<RoleSummary | 'new' | null>(null);
  const [rolesAbiertos, setRolesAbiertos] = useState(false);

  const selected = organizations.find((o) => o.id === selectedId) ?? null;
  /* Los permisos del módulo de organización Miembros (`MOD-0006`). Puertos y
     la red de contexto ya no viven acá: son módulos de organización propios y se
     muestran en «Mi organización». */
  const puedeRoles = selected?.permissions.includes('MOD-0006:roles') ?? false;
  const puedeMiembros = selected?.permissions.includes('MOD-0006:members') ?? false;

  useEffect(() => {
    void (async () => {
      try {
        const [orgs, cat] = await Promise.all([listOrganizations(), fetchPermissionCatalog()]);
        setOrganizations(orgs);
        setCatalog(cat);
        setSelectedId((actual) => organizacionFija ?? actual ?? orgs[0]?.id ?? null);
      } catch (err) {
        setLoadError(mensajeDeError(err, 'Error al cargar las organizaciones'));
      } finally {
        setLoading(false);
      }
    })();
  }, [organizacionFija]);

  const refreshOrganizations = useCallback(async (seleccionar?: string): Promise<void> => {
    setLoadError(null);
    try {
      const orgs = await listOrganizations();
      setOrganizations(orgs);
      setSelectedId((actual) => seleccionar ?? actual ?? orgs[0]?.id ?? null);
    } catch (err) {
      setLoadError(mensajeDeError(err, 'Error al cargar las organizaciones'));
    }
  }, []);

  const refreshOrg = useCallback(async (organizationId: string): Promise<void> => {
    setError(null);
    try {
      const [r, m] = await Promise.all([listRoles(organizationId), listMembers(organizationId)]);
      setRoles(r);
      setMembers(m);
    } catch (err) {
      setRoles([]);
      setMembers([]);
      setError(mensajeDeError(err, 'Error al cargar la organización'));
    }
  }, []);

  useEffect(() => {
    if (selectedId) void refreshOrg(selectedId);
  }, [selectedId, refreshOrg]);



  async function conManejoDeError(accion: () => Promise<void>, fallback: string): Promise<void> {
    setError(null);
    try {
      await accion();
      if (selectedId) await refreshOrg(selectedId);
      onRolesChanged?.();
    } catch (err) {
      setError(mensajeDeError(err, fallback));
    }
  }

  /* LA TABLA DE ROLES ES LA DEL TEMPLATE (`Tabla`), no el `DataTable` propio.
     `permisos` es la elástica: es la única columna de largo impredecible —un rol
     puede tener uno o quince— y el template es explícito en que sólo el texto
     libre aguanta puntos suspensivos. */
  /* El alcance va como chip DEBAJO del nombre y no en una columna propia: es
     un atributo del rol que se lee junto con él, y una columna de dos valores
     posibles se comía ancho que necesita `permisos`. La descripción existe como
     columna pero arranca OCULTA: se prende desde los tres puntos del encabezado
     cuando alguien quiere ver de qué trata cada rol. */
  const COLUMNAS_ROL: ColumnaDeTabla[] = [
    /* 300 contra 700: el ancho que sobra se reparte en proporción al ideal de
       cada columna, así que el nombre queda en ~30% de la tabla. Arriba, para
       no flotar en el medio cuando los permisos ocupan dos renglones. */
    { id: 'name', label: 'Rol', dato: 'name', w: 300, tip: true, va: 'arriba' },
    { id: 'permisos', label: 'Permisos', w: 700, orden: false, elastica: true },
    { id: 'descripcion', label: 'Descripción', dato: 'description', w: 280, orden: false },
  ];

  /* Editar y Eliminar van al menú de fila y no a botones sueltos en una columna
     `actions`: es donde el template pone las acciones, y es lo que le da a la
     tabla su columna `__menu` con el objetivo táctil de 44px. */
  const menuDeRol = (r: RoleSummary) =>
    puedeRoles
      ? {
          groups: [
            { items: [{ id: 'editar', label: 'Editar el rol' }] },
            { items: [{ id: 'eliminar', label: 'Eliminar el rol', danger: true }] },
          ],
          onSelect: (id: string) => {
            if (id === 'editar') { setEditingRole(r); return; }
            if (!selectedId) return;
            if (!window.confirm(`¿Eliminar el rol '${r.name}'?`)) return;
            void conManejoDeError(() => deleteRole(selectedId, r.id), 'Error al eliminar el rol');
          },
        }
      : null;

  function celdaDeRol(r: RoleSummary, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'name') {
      return (
        <div className="flex flex-col items-start gap-1 py-2">
          <span className="font-medium">{r.name}</span>
          {/* La `.badge` del tema (Basecoat + basecoat-ext.css), no el átomo
              `Badge`: ése es del look anterior y sus tokens ya no existen. */}
          <span className="badge" data-variant={r.scope === 'org' ? undefined : 'mute'}>
            {r.scope === 'org' ? 'Organización' : 'Proyecto'}
          </span>
        </div>
      );
    }
    if (c.id === 'descripcion') {
      return r.description ? (
        <span className="whitespace-normal text-xs opacity-80">{r.description}</span>
      ) : (
        <span className="text-xs opacity-50">Sin descripción</span>
      );
    }
    if (c.id === 'permisos') {
      /* UN ROL SIN PERMISOS NO ES UNA CELDA VACÍA: es la causa del 403 que
         nadie entiende (la suite se asigna al proyecto, el permiso al rol, y
         nada los cruza). Se dice con todas las letras y no con un guion. */
      if (r.permissions.length === 0) {
        return <span className="text-xs opacity-70">Sin permisos — nadie con este rol puede hacer nada</span>;
      }
      return <PermisosCompactos permisos={r.permissions} nombres={nombresDeModulo} descripciones={descripciones} />;
    }
    return null;
  }

  const COLUMNAS_MIEMBRO: ColumnaDeTabla[] = [
    { id: 'username', label: 'Usuario', dato: 'username', w: 240, tip: true, elastica: true },
    /* El rol se EDITA en la celda: es la acción principal de esta tabla, y
       mandarla a un modal agregaría dos clics a lo único que se viene a hacer
       acá. Por eso no se puede ordenar — la celda no es un valor, es un control. */
    { id: 'rol', label: 'Roles en la organización', w: 360, orden: false, elastica: true },
  ];

  const menuDeMiembro = (m: OrganizationMember) =>
    puedeMiembros
      ? {
          groups: [{ items: [{ id: 'quitar', label: 'Sacar de la organización', danger: true }] }],
          onSelect: () => {
            if (!selectedId) return;
            if (!window.confirm(`¿Sacar a '${m.username}' de la organización?`)) return;
            void conManejoDeError(() => removeMember(selectedId, m.user_id), 'Error al quitar el miembro');
          },
        }
      : null;

  function celdaDeMiembro(m: OrganizationMember, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'username') return <span className="font-medium">{m.username}</span>;
    if (c.id === 'rol') {
      return (
        <RolesDelMiembro
          roles={roles}
          asignados={m.roles}
          editable={puedeMiembros}
          onCambiar={(ids) => {
            if (!selectedId) return;
            void conManejoDeError(() => setMemberRoles(selectedId, m.user_id, ids), 'Error al cambiar los roles');
          }}
        />
      );
    }
    return null;
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (loadError) {
    // El fallo se muestra COMO fallo. Antes esto caía en el "no hay
    // organizaciones" de abajo y un 404 del backend se leía como una base vacía.
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">
          No se pudieron cargar las organizaciones: {loadError}
        </div>
        <Button
          onClick={() => void refreshOrganizations()}
          variant="outline"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
      </div>

      {organizations.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay ninguna organización. Creá la primera desde la cabecera.</p>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">{error}</div>
      )}

      {selected && !puedeRoles && !puedeMiembros && (
        <p className="text-sm text-muted-foreground">No tenés permisos para configurar esta organización.</p>
      )}

      {/* LOS ROLES EN UN ACORDEÓN (el `.accordion` de Basecoat, que el tema ya
          estila): contraído —el estado de partida— dice cuántos hay y cuáles;
          expandido, la tabla. La tabla es lo que se viene a editar de vez en
          cuando; el resumen es lo que se quiere saber cada vez que se entra. */}
      <section className="accordion overflow-hidden rounded-xl border border-[var(--sw-line-strong)] bg-card">
        <details className="group" open={rolesAbiertos} onToggle={(e) => setRolesAbiertos(e.currentTarget.open)}>
          <summary className="items-center gap-3 px-4 py-3 hover:bg-accent hover:no-underline">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-foreground">Roles</span>
                <span className="text-xs text-muted-foreground">{resumenDeRoles(roles)}</span>
              </span>
              {/* Contraído, los nombres: es lo que se busca al entrar. Abierto
                  ya están en la tabla, y repetirlos sería ruido. */}
              {!rolesAbiertos && roles.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <span
                      key={r.id}
                      className="badge"
                      data-variant={r.scope === 'org' ? undefined : 'mute'}
                      title={`${r.scope === 'org' ? 'Rol de organización' : 'Rol de proyecto'} · ${r.permissions.length} permiso(s)${r.description ? ` — ${r.description}` : ''}`}
                    >
                      {r.name}
                    </span>
                  ))}
                </span>
              )}
            </div>
            {/* Adentro del summary, así que el clic no tiene que plegar el
                acordeón: se corta acá. */}
            <Button
              disabled={!puedeRoles}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditingRole('new');
              }}
              variant="primary" className="shrink-0"
            >
              + Nuevo rol
            </Button>
            <Icon name="chevron" className="text-muted-foreground" />
          </summary>
          {/* Cerrado, este div NO EXISTE (`hidden`), y el separador va sólo con
              el acordeón abierto. Basecoat no oculta el contenido de un
              <details> cerrado: lo deja en alto cero con una transición, y el
              borde de este div quedaba asomando debajo del encabezado. */}
          <div className="hidden border-[var(--sw-line-strong)] p-3 group-open:block group-open:border-t">
            <Tabla<RoleSummary>
              titulo="Roles"
              columnas={COLUMNAS_ROL}
              ocultasInicial={['descripcion']}
              filas={roles}
              clave={(r) => r.id}
              nombreFila={(r) => r.name}
              seleccion={false}
              menuFila={menuDeRol}
              celda={celdaDeRol}
              porPagina={25}
              opcionesPagina={[25, 50]}
              /* EL VACÍO DICE LA CONSECUENCIA, no "no hay filas". Sin roles nadie
                 puede nada adentro de los proyectos de esta organización, y ese es
                 el dato que evita buscar la causa en el eje equivocado. */
              textos={{
                vacio: 'Esta organización todavía no tiene roles',
                vacioPaso:
                  'Sin un rol nadie puede hacer nada adentro de sus proyectos: la suite decide qué se ve, el rol decide qué se puede.',
              }}
            />
          </div>
        </details>
      </section>

      {!sinMiembros && (
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Miembros</h2>
        <Tabla<OrganizationMember>
          titulo="Miembros"
          columnas={COLUMNAS_MIEMBRO}
          filas={members}
          clave={(m) => m.user_id}
          nombreFila={(m) => m.username}
          seleccion={false}
          menuFila={menuDeMiembro}
          celda={celdaDeMiembro}
          porPagina={25}
          opcionesPagina={[25, 50]}
          textos={{ vacio: 'Esta organización todavía no tiene miembros' }}
        />

        {/* Una organización sin miembros ya no es un estado roto —se puede fundar
            vacía— pero sí uno incompleto: conviene decir cómo se sale, porque las
            dos salidas están en pantallas distintas. */}
        {selected && members.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Esta organización todavía no tiene miembros. Dá de alta un usuario eligiéndola como su organización.
          </p>
        )}

      </section>

      )}

      {/* `key` por organización: el estado del formulario no tiene que
          sobrevivir al cambio de organización en el select de arriba. */}

      {editingRole && selectedId && (
        <RoleFormModal
          organizationId={selectedId}
          catalog={catalog}
          editing={editingRole === 'new' ? null : editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null);
            void refreshOrg(selectedId);
            onRolesChanged?.();
          }}
        />
      )}
    </div>
  );
}
