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
import type { UserSummary } from '../../lib/users-api.js';
import { mensajeDeError } from './errores.js';
import { agruparPorModulo } from './permisos-por-modulo.js';
import { Tabla, type ColumnaDeTabla } from '../ui/Tabla.js';
import { StatusBadge } from '../ui/atoms/StatusBadge.js';

/** Controles DENTRO de un modal, que sigue siendo una tarjeta clara sobre el overlay. */
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400';

/**
 * Controles que van directo sobre la página, que es oscura (`--app-bg`).
 * Son dos clases y no una porque son dos superficies: un input claro sobre el
 * fondo oscuro —o uno oscuro dentro del modal blanco— se lee mal en el otro.
 */
/**
 * `[&>option]` no es cosmético: el popup de un `<select>` lo pinta el sistema,
 * no la tarjeta, y las opciones heredan sólo el COLOR del control. Con
 * `text-white` heredado sobre el fondo claro del popup el texto queda blanco
 * sobre blanco — invisible salvo el ítem resaltado. Por eso las opciones llevan
 * su propia superficie, explícita.
 */
const PAGE_INPUT_CLASS =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 [&>option]:bg-[#221f1d] [&>option]:text-white';

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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{editing ? 'Editar rol' : 'Nuevo rol'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            Cerrar
          </button>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Nombre</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Lector, Operador, Administrador…"
          className={`mb-3 ${INPUT_CLASS}`}
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Descripción</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={`mb-3 ${INPUT_CLASS}`}
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Alcance</label>
        <select
          value={form.scope}
          disabled={!!editing}
          onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as RoleScope }))}
          className={`mb-1 ${INPUT_CLASS} disabled:bg-slate-100`}
        >
          <option value="project">Por proyecto — se asigna en un proyecto puntual</option>
          <option value="org">De organización — vale en todos sus proyectos</option>
        </select>
        <p className="mb-3 text-[11px] text-slate-400">
          Los permisos SUMAN: el rol de organización es un piso que un rol de proyecto no puede recortar.
        </p>

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Permisos</label>
        <div className="mb-4 space-y-1 rounded-lg border border-slate-200 p-2">
          {catalog.map((p) => (
            <label
              key={p.permission}
              className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={form.permissions.includes(p.permission)}
                onChange={() => togglePermission(p.permission)}
              />
              <span>
                <span className="font-mono text-xs text-slate-900">{p.permission}</span>
                {p.governance && (
                  <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                    gobierno
                  </span>
                )}
                <span className="block text-xs text-slate-500">{p.description}</span>
              </span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </div>
  );
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
  users,
  focusOrganizationId,
  onMembersChanged,
}: {
  users: UserSummary[];
  /**
   * La organización que hay que mostrar, cuando la elige la página (recién
   * creada desde la cabecera). Es un pedido de enfoque, no estado controlado:
   * el panel sigue siendo dueño de la selección, así que cambiarla desde su
   * propio select no obliga a la página a re-renderizar.
   */
  focusOrganizationId?: string | null;
  /**
   * Avisar que la membresía cambió. La tabla de usuarios de la página muestra a
   * qué organización pertenece cada uno: sin esto, agregar o quitar un miembro
   * acá deja esa columna mintiendo hasta el próximo refresh.
   */
  onMembersChanged?: () => void;
}): React.ReactElement {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PermissionInfo[]>([]);
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
  const [nuevoMiembro, setNuevoMiembro] = useState<{ userId: string; roleId: string }>({ userId: '', roleId: '' });

  const selected = organizations.find((o) => o.id === selectedId) ?? null;
  const puedeRoles = selected?.permissions.includes('roles:manage') ?? false;
  const puedeMiembros = selected?.permissions.includes('members:manage') ?? false;

  useEffect(() => {
    void (async () => {
      try {
        const [orgs, cat] = await Promise.all([listOrganizations(), fetchPermissionCatalog()]);
        setOrganizations(orgs);
        setCatalog(cat);
        setSelectedId((actual) => actual ?? orgs[0]?.id ?? null);
      } catch (err) {
        setLoadError(mensajeDeError(err, 'Error al cargar las organizaciones'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  // Una organización recién creada desde la cabecera todavía no está en la
  // lista local: hay que recargarla, no sólo seleccionar un id que el select no
  // tiene (se vería vacío, con los roles de la anterior).
  useEffect(() => {
    if (focusOrganizationId) void refreshOrganizations(focusOrganizationId);
  }, [focusOrganizationId, refreshOrganizations]);

  /**
   * A quién se puede agregar: los que no pertenecen a NINGUNA organización.
   *
   * No alcanza con excluir a los miembros de ésta. Una persona pertenece a una
   * sola, así que alguien que ya está en otra vuelve con un 409 — ofrecerlo es
   * ofrecer una opción que siempre falla. Y a los de esta misma organización no
   * se los agrega: se les cambia el rol en su fila.
   */
  const candidatos = useMemo(
    () => users.filter((u) => !u.organization && !members.some((m) => m.user_id === u.id)),
    [users, members],
  );

  async function conManejoDeError(
    accion: () => Promise<void>,
    fallback: string,
    /** Si la acción tocó miembros, la tabla de usuarios de la página quedó vieja. */
    tocaMiembros = false,
  ): Promise<void> {
    setError(null);
    try {
      await accion();
      if (selectedId) await refreshOrg(selectedId);
      if (tocaMiembros) onMembersChanged?.();
    } catch (err) {
      setError(mensajeDeError(err, fallback));
    }
  }

  /* LA TABLA DE ROLES ES LA DEL TEMPLATE (`Tabla`), no el `DataTable` propio.
     `permisos` es la elástica: es la única columna de largo impredecible —un rol
     puede tener uno o quince— y el template es explícito en que sólo el texto
     libre aguanta puntos suspensivos. */
  const COLUMNAS_ROL: ColumnaDeTabla[] = [
    { id: 'name', label: 'Rol', dato: 'name', w: 220, tip: true },
    { id: 'scope', label: 'Alcance', dato: 'scope', w: 130 },
    { id: 'permisos', label: 'Permisos', w: 420, orden: false, elastica: true },
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
        <div>
          <span className="font-medium">{r.name}</span>
          {r.description ? <span className="block text-xs opacity-70">{r.description}</span> : null}
        </div>
      );
    }
    if (c.id === 'scope') {
      return <StatusBadge label={r.scope === 'org' ? 'Organización' : 'Proyecto'} tone={r.scope === 'org' ? 'info' : 'neutral'} />;
    }
    if (c.id === 'permisos') {
      /* UN ROL SIN PERMISOS NO ES UNA CELDA VACÍA: es la causa del 403 que
         nadie entiende (la suite se asigna al proyecto, el permiso al rol, y
         nada los cruza). Se dice con todas las letras y no con un guion. */
      if (r.permissions.length === 0) {
        return <span className="text-xs opacity-70">Sin permisos — nadie con este rol puede hacer nada</span>;
      }
      /* Agrupados por módulo: la pregunta que se le hace a esta celda es "¿de
         qué se puede ocupar este rol?", y una fila plana de nueve chips de tres
         familias obliga a contarlos. El rótulo es la `key` cruda —con su id—
         porque es lo que distingue un módulo de otro. */
      return (
        <div className="flex flex-col gap-1">
          {agruparPorModulo(r.permissions).map((g) => (
            <div key={g.titulo} className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide opacity-50">{g.titulo}</span>
              {g.items.map((i) => (
                <StatusBadge key={i.permiso} label={i.etiqueta} tone={g.plataforma ? 'neutral' : 'info'} />
              ))}
            </div>
          ))}
        </div>
      );
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
            void conManejoDeError(() => removeMember(selectedId, m.user_id), 'Error al quitar el miembro', true);
          },
        }
      : null;

  function celdaDeMiembro(m: OrganizationMember, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'username') return <span className="font-medium">{m.username}</span>;
    if (c.id === 'rol') {
      /* UN TOGGLE POR ROL, no un `<select multiple>`. Los permisos de un miembro
         son la UNIÓN de sus roles, así que lo que hay que poder leer de un
         vistazo es cuáles tiene — y un multi-select nativo esconde eso detrás
         de un scroll y de un Ctrl+clic que nadie descubre. Acá cada rol es un
         chip: encendido = lo tiene. */
      /* SÓLO LOS DE ORGANIZACIÓN. Este eje no otorga nada sobre proyectos, así
         que ofrecer acá un rol `scope: project` es ofrecer algo que se guarda
         bien y no hace nada — el chip queda encendido y la persona sigue sin
         poder entrar al proyecto. Pasó: «Colaborador» (que lleva `project:read`)
         puesto acá en vez de en el proyecto, y la suite nunca apareció.
         La API lo rechaza también (`RoleNotForOrganizationAxisError`); esto es
         para que no se pueda ni intentar. */
      const deOrganizacion = roles.filter((r) => r.scope === 'org');
      const asignados = new Set(m.roles.map((r) => r.role_id));
      const alternar = (roleId: string): void => {
        if (!selectedId) return;
        const siguiente = new Set(asignados);
        if (siguiente.has(roleId)) siguiente.delete(roleId);
        else siguiente.add(roleId);
        void conManejoDeError(
          () => setMemberRoles(selectedId, m.user_id, [...siguiente]),
          'Error al cambiar los roles',
          true,
        );
      };
      /* Lo que está asignado pero NO se ofrece: un rol borrado por debajo, o
         uno de proyecto que quedó colgado de acá antes de que esto se
         filtrara. Se muestra igual —desaparecer sin decirlo dejaría una fila
         que nadie puede limpiar— y se puede sacar con un clic. */
      const colgados = m.roles.filter((r) => !deOrganizacion.some((x) => x.id === r.role_id));
      return (
        <div className="flex flex-wrap gap-1">
          {deOrganizacion.map((r) => {
            const activo = asignados.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                disabled={!puedeMiembros}
                onClick={() => alternar(r.id)}
                aria-pressed={activo}
                title={activo ? `Sacarle «${r.name}»` : `Darle «${r.name}»`}
                className={`rounded-full border px-2 py-0.5 text-[11px] disabled:opacity-40 ${
                  activo
                    ? 'border-transparent bg-[var(--sw-accent)] text-white'
                    : 'border-white/20 opacity-60 hover:opacity-100'
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
                disabled={!puedeMiembros}
                onClick={() => alternar(r.role_id)}
                title={
                  deProyecto
                    ? `«${deProyecto.name}» es un rol de proyecto: acá no otorga nada. Sacalo y asignalo en el proyecto.`
                    : 'Este rol ya no existe. Clic para sacarlo.'
                }
                className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-300 disabled:opacity-40"
              >
                {r.role_name ?? '(rol desconocido)'} ✕
              </button>
            );
          })}
          {/* Pertenecer sin roles es un estado real y el que más confunde: la
              persona entra y no puede nada. Se dice, no se deja en blanco. */}
          {m.roles.length === 0 ? <span className="text-[11px] opacity-60">Sin roles — no puede nada</span> : null}
          {/* Sin roles de organización no hay nada que ofrecer, y el vacío se
              lee como un bug de la pantalla si no se dice por qué. */}
          {deOrganizacion.length === 0 ? (
            <span className="text-[11px] opacity-60">Esta organización no tiene roles de organización</span>
          ) : null}
        </div>
      );
    }
    return null;
  }

  if (loading) return <p className="text-sm text-slate-400">Cargando…</p>;

  if (loadError) {
    // El fallo se muestra COMO fallo. Antes esto caía en el "no hay
    // organizaciones" de abajo y un 404 del backend se leía como una base vacía.
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          No se pudieron cargar las organizaciones: {loadError}
        </div>
        <button
          type="button"
          onClick={() => void refreshOrganizations()}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/10"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Organización</label>
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className={`${PAGE_INPUT_CLASS} min-w-64`}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.slug})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!puedeRoles}
          onClick={() => setEditingRole('new')}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          + Nuevo rol
        </button>
      </div>

      {organizations.length === 0 && (
        <p className="text-sm text-slate-400">Todavía no hay ninguna organización. Creá la primera desde la cabecera.</p>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {selected && !puedeRoles && !puedeMiembros && (
        <p className="text-sm text-slate-400">No tenés permisos para configurar esta organización.</p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white">Roles</h2>
        <Tabla<RoleSummary>
          titulo="Roles"
          columnas={COLUMNAS_ROL}
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
            vacioPaso: 'Sin un rol nadie puede hacer nada adentro de sus proyectos: la suite decide qué se ve, el rol decide qué se puede.',
          }}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white">Miembros</h2>
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
          <p className="mt-2 text-xs text-slate-400">
            Esta organización todavía no tiene miembros. Sumá a alguien acá abajo, o dá de alta un usuario nuevo
            eligiéndola como su organización.
          </p>
        )}

        {puedeMiembros && candidatos.length > 0 && roles.length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select
              value={nuevoMiembro.userId}
              onChange={(e) => setNuevoMiembro((n) => ({ ...n, userId: e.target.value }))}
              className={`${PAGE_INPUT_CLASS} w-56`}
            >
              <option value="">Agregar usuario…</option>
              {candidatos.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
            <select
              value={nuevoMiembro.roleId}
              onChange={(e) => setNuevoMiembro((n) => ({ ...n, roleId: e.target.value }))}
              className={`${PAGE_INPUT_CLASS} w-56`}
            >
              <option value="">con el rol…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!nuevoMiembro.userId || !nuevoMiembro.roleId}
              onClick={() => {
                if (!selectedId) return;
                const { userId, roleId } = nuevoMiembro;
                void conManejoDeError(
                  async () => {
                    // El alta entra con UN rol; los demás se suman después
                    // desde los chips de su fila.
                    await setMemberRoles(selectedId, userId, [roleId]);
                    setNuevoMiembro({ userId: '', roleId: '' });
                  },
                  'Error al agregar el miembro',
                  true,
                );
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        )}
      </section>

      {editingRole && selectedId && (
        <RoleFormModal
          organizationId={selectedId}
          catalog={catalog}
          editing={editingRole === 'new' ? null : editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null);
            void refreshOrg(selectedId);
          }}
        />
      )}
    </div>
  );
}
