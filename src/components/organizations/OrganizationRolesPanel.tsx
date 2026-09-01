import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createOrganization,
  createRole,
  deleteRole,
  fetchPermissionCatalog,
  listMembers,
  listOrganizations,
  listRoles,
  removeMember,
  setMemberRole,
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
import { useAuth } from '../../hooks/useAuth.js';
import { DataTable, type DataTableColumn } from '../ui/organisms/DataTable.js';
import { StatusBadge } from '../ui/atoms/StatusBadge.js';

/** Controles DENTRO de un modal, que sigue siendo una tarjeta clara sobre el overlay. */
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400';

/**
 * Controles que van directo sobre la página, que es oscura (`--app-bg`).
 * Son dos clases y no una porque son dos superficies: un input claro sobre el
 * fondo oscuro —o uno oscuro dentro del modal blanco— se lee mal en el otro.
 */
const PAGE_INPUT_CLASS =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400';

function mensajeDeError(err: unknown, fallback: string): string {
  // Un 409 no es una falla: es el invariante del último administrador o un rol
  // en uso, y su mensaje explica cómo salir. Perderlo detrás de un "error al
  // guardar" deja a quien configura sin saber qué hacer.
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

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

function OrganizationFormModal({
  users,
  onClose,
  onCreated,
}: {
  users: UserSummary[];
  onClose: () => void;
  onCreated: (id: string) => void;
}): React.ReactElement {
  const [form, setForm] = useState({ name: '', slug: '', owner_user_id: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!form.name.trim()) throw new Error('La organización necesita un nombre');
      if (!form.owner_user_id) throw new Error('Elegí quién la va a administrar');
      const org = await createOrganization({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        owner_user_id: form.owner_user_id,
      });
      onCreated(org.id);
    } catch (err) {
      setError(mensajeDeError(err, 'Error al crear la organización'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Nueva organización</h2>
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
          className={`mb-3 ${INPUT_CLASS}`}
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Slug (opcional)</label>
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          placeholder="se deriva del nombre"
          className={`mb-3 ${INPUT_CLASS}`}
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Administrador</label>
        <select
          value={form.owner_user_id}
          onChange={(e) => setForm((f) => ({ ...f, owner_user_id: e.target.value }))}
          className={`mb-1 ${INPUT_CLASS}`}
        >
          <option value="">Elegí un usuario…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username}
            </option>
          ))}
        </select>
        <p className="mb-4 text-[11px] text-slate-400">
          Nace con un rol «Administrador» que tiene todo el catálogo, y esta persona adentro. Sin miembro fundador nadie
          podría entrar a configurarla.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Creando…' : 'Crear'}
        </button>
      </form>
    </div>
  );
}

/**
 * Configuración de roles y miembros de una organización.
 *
 * Vive en la sección "Usuarios" porque es la otra mitad de la misma pregunta:
 * el alta de usuarios dice QUIÉN entra, y esto dice QUÉ puede hacer. Los
 * permisos no se inventan acá — el catálogo lo sirve el backend
 * (`GET /api/organizations/permissions`), que es la única forma de que una
 * casilla tildada corresponda a un guard que existe.
 */
export function OrganizationRolesPanel({ users }: { users: UserSummary[] }): React.ReactElement {
  const { user: currentUser } = useAuth();
  const puedeCrearOrganizaciones = currentUser?.role === 'superadmin';
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
  const [creandoOrg, setCreandoOrg] = useState(false);
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

  /** Los que todavía no son miembros — agregar a uno que ya está sería cambiarle el rol, y eso se hace en su fila. */
  const candidatos = useMemo(
    () => users.filter((u) => !members.some((m) => m.user_id === u.id)),
    [users, members],
  );

  async function conManejoDeError(accion: () => Promise<void>, fallback: string): Promise<void> {
    setError(null);
    try {
      await accion();
      if (selectedId) await refreshOrg(selectedId);
    } catch (err) {
      setError(mensajeDeError(err, fallback));
    }
  }

  const roleColumns: Array<DataTableColumn<RoleSummary>> = [
    {
      key: 'name',
      header: 'Rol',
      render: (r) => (
        <div>
          <span className="font-medium text-[var(--card-text-secondary)]">{r.name}</span>
          {r.description && <span className="block text-xs text-[var(--card-text-secondary)] opacity-70">{r.description}</span>}
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Alcance',
      render: (r) => <StatusBadge label={r.scope === 'org' ? 'Organización' : 'Proyecto'} tone={r.scope === 'org' ? 'info' : 'neutral'} />,
    },
    {
      key: 'permissions',
      header: 'Permisos',
      render: (r) =>
        r.permissions.length === 0 ? (
          <span className="text-xs text-[var(--card-text-secondary)]">Sin permisos</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {r.permissions.map((p) => (
              <StatusBadge key={p} label={p} tone="neutral" />
            ))}
          </div>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={!puedeRoles}
            onClick={() => setEditingRole(r)}
            className="rounded-lg px-2 py-1 text-xs text-[var(--card-text-secondary)] hover:bg-white/10 disabled:opacity-40"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={!puedeRoles}
            onClick={() => {
              if (!selectedId) return;
              if (!window.confirm(`¿Eliminar el rol '${r.name}'?`)) return;
              void conManejoDeError(() => deleteRole(selectedId, r.id), 'Error al eliminar el rol');
            }}
            className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-40"
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  const memberColumns: Array<DataTableColumn<OrganizationMember>> = [
    {
      key: 'username',
      header: 'Usuario',
      render: (m) => <span className="font-medium text-[var(--card-text-secondary)]">{m.username}</span>,
    },
    {
      key: 'role',
      header: 'Rol en la organización',
      render: (m) => (
        <select
          value={m.role_id}
          disabled={!puedeMiembros}
          onChange={(e) => {
            if (!selectedId) return;
            void conManejoDeError(() => setMemberRole(selectedId, m.user_id, e.target.value), 'Error al cambiar el rol');
          }}
          className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-[var(--card-text-secondary)] disabled:opacity-40"
        >
          {/* Si el rol se borró por debajo, se muestra como tal en vez de saltar a otro en silencio. */}
          {!roles.some((r) => r.id === m.role_id) && <option value={m.role_id}>{m.role_name ?? '(rol desconocido)'}</option>}
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <button
          type="button"
          disabled={!puedeMiembros}
          onClick={() => {
            if (!selectedId) return;
            if (!window.confirm(`¿Sacar a '${m.username}' de la organización?`)) return;
            void conManejoDeError(() => removeMember(selectedId, m.user_id), 'Error al quitar el miembro');
          }}
          className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-40"
        >
          Quitar
        </button>
      ),
    },
  ];

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
        {puedeCrearOrganizaciones && (
          <button
            type="button"
            onClick={() => setCreandoOrg(true)}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            + Nueva organización
          </button>
        )}
      </div>

      {organizations.length === 0 && (
        <p className="text-sm text-slate-400">
          Todavía no hay ninguna organización.
          {puedeCrearOrganizaciones ? ' Creá la primera con el botón de arriba.' : ''}
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {selected && !puedeRoles && !puedeMiembros && (
        <p className="text-sm text-slate-400">No tenés permisos para configurar esta organización.</p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white">Roles</h2>
        <DataTable columns={roleColumns} rows={roles} getRowKey={(r) => r.id} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white">Miembros</h2>
        <DataTable columns={memberColumns} rows={members} getRowKey={(m) => m.user_id} />

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
                void conManejoDeError(async () => {
                  await setMemberRole(selectedId, userId, roleId);
                  setNuevoMiembro({ userId: '', roleId: '' });
                }, 'Error al agregar el miembro');
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        )}
      </section>

      {creandoOrg && (
        <OrganizationFormModal
          users={users}
          onClose={() => setCreandoOrg(false)}
          onCreated={(id) => {
            setCreandoOrg(false);
            void refreshOrganizations(id);
          }}
        />
      )}

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
