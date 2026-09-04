import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listUsers, createUser, updateUser, deleteUser } from '../lib/users-api.js';
import type { UserSummary, UserRole, ProjectRoleInput } from '../lib/users-api.js';
import { listRoles } from '../lib/organizations-api.js';
import type { RoleSummary } from '../lib/organizations-api.js';
import { DataTable, type DataTableColumn } from '../components/ui/organisms/DataTable.js';
import { Tab } from '../components/ui/atoms/Tab.js';
import { OrganizationRolesPanel } from '../components/organizations/OrganizationRolesPanel.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';

/**
 * Qué proyectos toca el usuario y CON QUÉ ROL.
 *
 * Se muestran los dos orígenes por separado porque son cosas distintas y la
 * pantalla sólo administra uno: las asignaciones por proyecto —lo que el
 * formulario edita— llevan el nombre del rol; los proyectos que el usuario ve
 * por su rol en la organización dueña se marcan aparte, para que no parezca que
 * el formulario los puede quitar.
 */
function ProjectAccessBadges({
  user,
  projects,
}: {
  user: UserSummary;
  projects: ProjectSummary[];
}): React.ReactElement {
  const nombreDe = (id: string): string => projects.find((p) => p.id === id)?.name ?? id;
  const asignados = new Set(user.project_roles.map((a) => a.project_id));
  const porOrganizacion = user.project_ids.filter((id) => !asignados.has(id));

  if (user.project_roles.length === 0 && porOrganizacion.length === 0) {
    return <span className="text-xs text-[var(--card-text-secondary)]">Sin proyectos asignados</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {user.project_roles.map((a) => (
        <StatusBadge key={a.project_id} label={`${nombreDe(a.project_id)} · ${a.role_name}`} tone="neutral" />
      ))}
      {porOrganizacion.map((id) => (
        <StatusBadge key={id} label={`${nombreDe(id)} · por organización`} tone="info" />
      ))}
    </div>
  );
}

interface UserFormState {
  username: string;
  password: string;
  role: UserRole;
  project_roles: ProjectRoleInput[];
}

const EMPTY_FORM: UserFormState = { username: '', password: '', role: 'user', project_roles: [] };

/**
 * Los roles asignables sobre un proyecto: los de SU organización y de scope
 * `project`.
 *
 * El filtro por scope no es cosmético — el backend rechaza un rol de scope
 * `org` sobre un proyecto. Ofrecerlo acá sería ofrecer una opción que sólo
 * falla al guardar. (Y el caso peligroso es el que parece inofensivo: elegir el
 * "Administrador" de la organización creyendo que queda acotado a ese
 * proyecto, cuando ese rol ya vale en todos.)
 *
 * Se ordenan de MENOR a mayor privilegio para que la opción por defecto —la
 * primera— sea la que menos otorga: tildar un proyecto sin mirar el select da
 * el acceso mínimo, no el máximo.
 */
function rolesAsignables(project: ProjectSummary, rolesPorOrg: Record<string, RoleSummary[]>): RoleSummary[] {
  const roles = project.organization_id ? (rolesPorOrg[project.organization_id] ?? []) : [];
  return roles
    .filter((r) => r.scope === 'project')
    .slice()
    .sort((a, b) => a.permissions.length - b.permissions.length || a.name.localeCompare(b.name));
}

function UserFormModal({
  projects,
  editing,
  onClose,
  onSaved,
}: {
  projects: ProjectSummary[];
  editing: UserSummary | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const [form, setForm] = useState<UserFormState>(
    editing
      ? {
          username: editing.username,
          password: '',
          role: editing.role,
          // Sólo las asignaciones explícitas: lo que el usuario ve por su rol en
          // la organización no lo administra este formulario, y traerlo acá haría
          // que guardar lo convierta en una asignación por proyecto que nadie pidió.
          project_roles: editing.project_roles.map((a) => ({ project_id: a.project_id, role_id: a.role_id })),
        }
      : EMPTY_FORM,
  );
  const [rolesPorOrg, setRolesPorOrg] = useState<Record<string, RoleSummary[]>>({});
  const [rolesListos, setRolesListos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Los roles de cada organización dueña de un proyecto: son las opciones del
  // select. Se piden una vez por organización y no una por proyecto — varios
  // proyectos comparten dueño y serían el mismo pedido repetido.
  useEffect(() => {
    let cancelado = false;
    const orgIds = [...new Set(projects.map((p) => p.organization_id).filter((id): id is string => !!id))];
    void Promise.all(
      orgIds.map(async (orgId) => [orgId, await listRoles(orgId).catch(() => [] as RoleSummary[])] as const),
    ).then((pares) => {
      if (cancelado) return;
      setRolesPorOrg(Object.fromEntries(pares));
      setRolesListos(true);
    });
    return () => {
      cancelado = true;
    };
  }, [projects]);

  function toggleProject(project: ProjectSummary): void {
    setForm((f) => {
      if (f.project_roles.some((a) => a.project_id === project.id)) {
        return { ...f, project_roles: f.project_roles.filter((a) => a.project_id !== project.id) };
      }
      // Al tildar se preselecciona el rol de MENOR privilegio disponible (el
      // primero de la lista ya ordenada). Sin default habría que elegir en dos
      // pasos; con el de mayor privilegio, un descuido daría de más.
      const disponibles = rolesAsignables(project, rolesPorOrg);
      const primero = disponibles[0];
      if (!primero) return f;
      return { ...f, project_roles: [...f.project_roles, { project_id: project.id, role_id: primero.id }] };
    });
  }

  function cambiarRol(projectId: string, roleId: string): void {
    setForm((f) => ({
      ...f,
      project_roles: f.project_roles.map((a) => (a.project_id === projectId ? { ...a, role_id: roleId } : a)),
    }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, {
          role: form.role,
          password: form.password || undefined,
          project_roles: form.project_roles,
        });
      } else {
        if (!form.username.trim() || !form.password.trim()) {
          throw new Error('Usuario y contraseña son obligatorios');
        }
        await createUser(form);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
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
          <h2 className="text-base font-semibold text-slate-900">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Usuario</label>
        <input
          type="text"
          value={form.username}
          disabled={!!editing}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 disabled:bg-slate-100"
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
          {editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
        </label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Tipo de cuenta</label>
        <select
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="user">Cliente</option>
          <option value="superadmin">Operador del producto</option>
        </select>

        {form.role === 'user' && (
          <>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Proyectos y rol en cada uno
            </label>
            <div className="mb-4 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {projects.map((p) => {
                const asignado = form.project_roles.find((a) => a.project_id === p.id);
                const disponibles = rolesAsignables(p, rolesPorOrg);
                // Un proyecto cuya organización no tiene ningún rol de proyecto
                // no se puede asignar: se deshabilita y se dice por qué, en vez
                // de dejar tildar algo que el backend va a rechazar.
                const sinRoles = rolesListos && disponibles.length === 0;
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={!!asignado}
                      disabled={sinRoles || !rolesListos}
                      onChange={() => toggleProject(p)}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    {asignado && (
                      <select
                        value={asignado.role_id}
                        onChange={(e) => cambiarRol(p.id, e.target.value)}
                        className="max-w-[45%] rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400"
                      >
                        {disponibles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {sinRoles && (
                      <span className="text-xs text-slate-400" title="Creá un rol de scope 'proyecto' en la pestaña «Roles por organización»">
                        sin roles de proyecto
                      </span>
                    )}
                  </div>
                );
              })}
              {projects.length === 0 && <p className="px-1 text-xs text-slate-400">No hay proyectos todavía</p>}
              {!rolesListos && projects.length > 0 && <p className="px-1 text-xs text-slate-400">Cargando roles…</p>}
            </div>
          </>
        )}

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
 * Las dos mitades de la misma pregunta: quién entra (usuarios) y qué puede
 * hacer (roles por organización). Son pestañas y no dos rutas porque configurar
 * un rol sin ver a quién le toca —y al revés— obliga a ir y volver.
 */
type UsersTab = 'usuarios' | 'organizaciones';

export function UsersPage(): React.ReactElement {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<UsersTab>('usuarios');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserSummary | 'new' | null>(null);

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([listUsers(), listProjects()]);
      setUsers(u);
      setProjects(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (currentUser && currentUser.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  async function handleDelete(u: UserSummary): Promise<void> {
    if (!window.confirm(`¿Eliminar el usuario '${u.username}'?`)) return;
    try {
      await deleteUser(u.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const columns: Array<DataTableColumn<UserSummary>> = [
    { key: 'username', header: 'Usuario', render: (u) => <span className="font-medium text-[var(--card-text-secondary)]">{u.username}</span> },
    {
      key: 'role',
      header: 'Tipo de cuenta',
      // "Rol" acá era la ambigüedad: este eje no es RBAC sino tenancy — quién
      // sos respecto del producto (el operador de la instalación, o gente de un
      // cliente). Los roles de verdad son los de organización y los de proyecto.
      render: (u) => <StatusBadge label={u.role === 'superadmin' ? 'Operador del producto' : 'Cliente'} tone={u.role === 'superadmin' ? 'info' : 'neutral'} />,
    },
    {
      key: 'projects',
      header: 'Proyectos',
      render: (u) => (u.role === 'superadmin' ? <span className="text-xs text-[var(--card-text-secondary)]">Todos</span> : <ProjectAccessBadges user={u} projects={projects} />),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u) => (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(u)} className="rounded-lg px-2 py-1 text-xs text-[var(--card-text-secondary)] hover:bg-white/10">
            Editar
          </button>
          <button type="button" onClick={() => void handleDelete(u)} className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    // Fondo oscuro y no `bg-white`: es la superficie de la app
    // (`--app-bg`, la misma que el shell y que ChatContent). Los dos
    // componentes que viven acá ya estaban pensados para fondo oscuro y sobre
    // blanco se veían mal — `Tab` pinta su texto con `rgba(255,255,255,.6)`
    // (blanco sobre blanco) y `DataTable` trae su propio `--table2-bg: #221f1d`.
    <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Administración de usuarios</h1>
        {tab === 'usuarios' && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Nuevo usuario
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-1 border-b border-white/10">
        <Tab label="Usuarios" size="sm" selected={tab === 'usuarios'} onClick={() => setTab('usuarios')} />
        <Tab label="Roles por organización" size="sm" selected={tab === 'organizaciones'} onClick={() => setTab('organizaciones')} />
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {tab === 'organizaciones' ? (
        <OrganizationRolesPanel users={users} />
      ) : loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <DataTable columns={columns} rows={users} getRowKey={(u) => u.id} />
      )}

      {editing && (
        <UserFormModal
          projects={projects}
          editing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
