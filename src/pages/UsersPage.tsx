import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listUsers, createUser, updateUser, deleteUser } from '../lib/users-api.js';
import type { UserSummary, AccountType, ProjectRoleInput } from '../lib/users-api.js';
import { listRoles, listOrganizations, removeMember, setMemberRoles } from '../lib/organizations-api.js';
import type { RoleSummary, OrganizationSummary } from '../lib/organizations-api.js';
import { Tabla, type ColumnaDeTabla } from '../components/ui/Tabla.js';
import { OrganizationRolesPanel } from '../components/organizations/OrganizationRolesPanel.js';
import { OrganizationFormModal } from '../components/organizations/OrganizationFormModal.js';
import { RolesDelMiembro } from '../components/organizations/RolesDelMiembro.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';
import { Toolbar, ToolbarBoton, ToolbarGrupo, ToolbarUtiles } from '../components/ui/molecules/Toolbar.js';
import { Combo } from '../components/ui/Combo.js';
import { filasDeUsuarios, pendientesDeAsignar } from '../lib/usuarios-por-organizacion.js';

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
        /* La clave lleva el rol: un proyecto puede aparecer varias veces, una
           por rol, y con la clave sólo del proyecto React las colapsa. */
        <StatusBadge
          key={`${a.project_id}:${a.role_id}`}
          label={`${nombreDe(a.project_id)} · ${a.role_name}`}
          tone="neutral"
        />
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
  account_type: AccountType;
  organization_id: string;
  organization_role_id: string;
  project_roles: ProjectRoleInput[];
}

const EMPTY_FORM: UserFormState = {
  username: '',
  password: '',
  account_type: 'client',
  organization_id: '',
  organization_role_id: '',
  project_roles: [],
};

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
          account_type: editing.account_type,
          // La organización no se edita acá: mudar a alguien de organización es
          // una operación de la pantalla de organizaciones, con su invariante de
          // gobierno. Este formulario sólo la elige al dar el alta.
          organization_id: '',
          organization_role_id: '',
          // Sólo las asignaciones explícitas: lo que el usuario ve por su rol en
          // la organización no lo administra este formulario, y traerlo acá haría
          // que guardar lo convierta en una asignación por proyecto que nadie pidió.
          project_roles: editing.project_roles.map((a) => ({ project_id: a.project_id, role_id: a.role_id })),
        }
      : EMPTY_FORM,
  );
  const [organizaciones, setOrganizaciones] = useState<OrganizationSummary[]>([]);
  const [rolesPorOrg, setRolesPorOrg] = useState<Record<string, RoleSummary[]>>({});
  const [rolesListos, setRolesListos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Los roles de cada organización dueña de un proyecto: son las opciones del
  // select. Se piden una vez por organización y no una por proyecto — varios
  // proyectos comparten dueño y serían el mismo pedido repetido.
  // Las organizaciones a las que se puede dar de alta a alguien. Es una lista
  // aparte de las dueñas de proyectos: una organización recién creada todavía no
  // tiene ninguno y aun así se puede entrar a ella.
  useEffect(() => {
    let cancelado = false;
    void listOrganizations()
      .then((orgs) => {
        if (!cancelado) setOrganizaciones(orgs);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  // Los roles de la organización elegida en el alta, que pueden no estar en
  // `rolesPorOrg` (ésa sólo trae las dueñas de algún proyecto).
  useEffect(() => {
    const orgId = form.organization_id;
    if (!orgId || rolesPorOrg[orgId]) return;
    let cancelado = false;
    void listRoles(orgId)
      .then((roles) => {
        if (!cancelado) setRolesPorOrg((prev) => ({ ...prev, [orgId]: roles }));
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [form.organization_id, rolesPorOrg]);

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
        // Destildar el proyecto se lleva TODOS sus roles, no sólo uno.
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

  /**
   * Alterna UN rol dentro de un proyecto. Varios conviven: los permisos sobre
   * el proyecto son la unión de todos sus roles.
   *
   * Sacar el último no desasigna el proyecto — queda tildado y sin roles, que
   * es un estado legítimo y distinto (pertenece, no puede nada). Desasignarlo
   * es destildar el proyecto.
   */
  function alternarRolDeProyecto(projectId: string, roleId: string): void {
    setForm((f) => {
      const tiene = f.project_roles.some((a) => a.project_id === projectId && a.role_id === roleId);
      return {
        ...f,
        project_roles: tiene
          ? f.project_roles.filter((a) => !(a.project_id === projectId && a.role_id === roleId))
          : [...f.project_roles, { project_id: projectId, role_id: roleId }],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, {
          account_type: form.account_type,
          ...(form.account_type === 'client' && form.organization_id && form.organization_role_id
            ? { organization_id: form.organization_id, organization_role_id: form.organization_role_id }
            : {}),
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
          value={form.account_type}
          onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value as AccountType }))}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="client">Cliente</option>
          <option value="operator">Operador del producto</option>
        </select>

        {form.account_type === 'client' && !editing && (
          <>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Organización
            </label>
            <select
              value={form.organization_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, organization_id: e.target.value, organization_role_id: '' }))
              }
              className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="">Una organización propia</option>
              {organizaciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

            {form.organization_id && (
              <>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Rol en la organización
                </label>
                <select
                  value={form.organization_role_id}
                  onChange={(e) => setForm((f) => ({ ...f, organization_role_id: e.target.value }))}
                  className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
                >
                  <option value="">Elegí un rol</option>
                  {(rolesPorOrg[form.organization_id] ?? [])
                    .filter((r) => r.scope === 'org')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
                <p className="mb-3 px-1 text-xs text-slate-400">
                  El rol de organización delimita: administra miembros, roles y auditoría. Lo que la persona
                  puede hacer en cada proyecto sale del rol que se le dé abajo.
                </p>
              </>
            )}
          </>
        )}

        {form.account_type === 'client' && (
          <>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Proyectos y rol en cada uno
            </label>
            <div className="mb-4 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {projects.map((p) => {
                const deEsteProyecto = form.project_roles.filter((a) => a.project_id === p.id);
                const asignado = deEsteProyecto.length > 0;
                const disponibles = rolesAsignables(p, rolesPorOrg);
                // Un proyecto cuya organización no tiene ningún rol de proyecto
                // no se puede asignar: se deshabilita y se dice por qué, en vez
                // de dejar tildar algo que el backend va a rechazar.
                const sinRoles = rolesListos && disponibles.length === 0;
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={asignado}
                      disabled={sinRoles || !rolesListos}
                      onChange={() => toggleProject(p)}
                    />
                    <span className="flex-1 truncate">{p.name}</span>
                    {/* VARIOS ROLES POR PROYECTO, no un select. Los permisos son
                        la unión, así que «Contable» + «Colaborador» en el mismo
                        proyecto es el caso normal — y con un select había que
                        fabricar un rol que fuera los dos. */}
                    {asignado && (
                      <span className="flex flex-wrap justify-end gap-1">
                        {disponibles.map((r) => {
                          const activo = deEsteProyecto.some((a) => a.role_id === r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => alternarRolDeProyecto(p.id, r.id)}
                              aria-pressed={activo}
                              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                activo
                                  ? 'border-transparent bg-indigo-600 text-white'
                                  : 'border-slate-300 text-slate-500 hover:border-slate-400'
                              }`}
                            >
                              {r.name}
                            </button>
                          );
                        })}
                        {deEsteProyecto.length === 0 ? (
                          <span className="text-[11px] text-amber-600">sin roles — no podrá entrar</span>
                        ) : null}
                      </span>
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
 * Compara sin distinguir mayúsculas ni acentos.
 *
 * Sin el `normalize`, buscar "ingenieria" no encuentra a «Ingeniería» — que es
 * exactamente lo que alguien escribe cuando teclea rápido, y el resultado vacío
 * se lee como "no existe" en vez de "lo escribiste sin tilde".
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * El texto sobre el que busca el filtro: exactamente lo que la fila MUESTRA.
 *
 * Que sea lo mostrado y no el objeto entero es la regla y no una comodidad. Un
 * `JSON.stringify(u)` buscaría también sobre campos que la pantalla no enseña
 * —ids internos, y mañana cualquier cosa que se agregue al DTO— y un acierto
 * ahí devuelve una fila sin que se vea POR QUÉ coincidió. Los datos sensibles
 * no llegan hasta acá (la API sirve `SafeUser`, sin `password_hash`), así que
 * esto no es lo que protege la password: es lo que evita que un campo futuro se
 * vuelva buscable sin que nadie lo haya decidido.
 */
function textoBuscable(user: UserSummary, projects: ProjectSummary[]): string {
  const nombreDe = (id: string): string => projects.find((p) => p.id === id)?.name ?? id;
  const partes = [
    user.username,
    user.account_type === 'operator' ? 'operador del producto' : 'cliente',
    user.organization?.organization_name ?? '',
    ...(user.organization?.roles.map((r) => r.role_name ?? '') ?? []),
    !user.organization && user.account_type !== 'operator' ? 'sin organización' : '',
    ...user.project_roles.map((a) => `${nombreDe(a.project_id)} ${a.role_name}`),
    ...user.project_ids.filter((id) => !user.project_roles.some((a) => a.project_id === id)).map(nombreDe),
  ];
  return normalizar(partes.join(' '));
}

/**
 * Una sola pantalla para las dos mitades de la misma pregunta: quién entra
 * (usuarios, con la organización a la que pertenece cada uno) y qué puede hacer
 * (los roles y miembros de esa organización).
 *
 * Eran dos pestañas y la separación no era neutral: una persona pertenece a UNA
 * organización, así que "a cuál pertenece" es un atributo suyo y no un dato de
 * otra pantalla. Sin esa columna, dar de alta a alguien o fundar una
 * organización se hacía a ciegas — se elegía a un usuario y el backend rebotaba
 * con un 409 recién al guardar.
 */
export function UsersPage(): React.ReactElement {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserSummary | 'new' | null>(null);
  const [creandoOrg, setCreandoOrg] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  /** La organización que eligió el panel de arriba: la tabla muestra sus miembros. */
  const [orgSeleccionada, setOrgSeleccionada] = useState<string | null>(null);
  /** La lista «Sin asignar» en vez de los miembros de la organización elegida. */
  const [verSinAsignar, setVerSinAsignar] = useState(false);
  const pendientes = useMemo(() => pendientesDeAsignar(users), [users]);
  /* LA ORGANIZACIÓN SE ELIGE EN LA BARRA, y la página es la dueña de la
     elección: la usan el panel de roles (que ya no tiene selector propio) y la
     tabla de usuarios. */
  const [organizaciones, setOrganizaciones] = useState<OrganizationSummary[]>([]);
  const cargarOrganizaciones = useCallback(async (elegir?: string): Promise<void> => {
    try {
      const orgs = await listOrganizations();
      setOrganizaciones(orgs);
      setOrgSeleccionada((actual) => elegir ?? actual ?? orgs[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las organizaciones');
    }
  }, []);
  useEffect(() => {
    void cargarOrganizaciones();
  }, [cargarOrganizaciones]);

  /** Los roles de la organización elegida: los chips de la columna «Roles en la organización». */
  const [rolesOrg, setRolesOrg] = useState<RoleSummary[]>([]);
  const [versionRoles, setVersionRoles] = useState(0);
  const [nuevoMiembro, setNuevoMiembro] = useState<{ userId: string; roleId: string }>({ userId: '', roleId: '' });

  useEffect(() => {
    if (!orgSeleccionada) {
      setRolesOrg([]);
      return;
    }
    let vigente = true;
    void listRoles(orgSeleccionada)
      .then((r) => {
        if (vigente) setRolesOrg(r);
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : 'Error al cargar los roles');
      });
    return () => {
      vigente = false;
    };
  }, [orgSeleccionada, versionRoles]);

  /* A quién se puede sumar: clientes que no pertenecen a NINGUNA organización.
     Una persona pertenece a una sola, así que ofrecer a alguien de otra es
     ofrecer un 409 seguro; y a los de ésta se les cambia el rol en su fila. */
  const candidatos = useMemo(() => users.filter((u) => u.account_type === 'client' && !u.organization), [users]);

  /** Corre un cambio de membresía y recarga la tabla. */
  async function cambiarMembresia(accion: () => Promise<void>, fallback: string): Promise<void> {
    setError(null);
    try {
      await accion();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  }
  /* Elegir otra organización en el panel es pedir sus miembros: sale de «Sin
     asignar». Estable, porque el panel la usa en un efecto. */
  const alElegirOrganizacion = useCallback((id: string | null) => {
    setOrgSeleccionada(id);
    setVerSinAsignar(false);
  }, []);

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

  if (currentUser && currentUser.account_type !== 'operator') {
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

  /**
   * El filtro exige TODAS las palabras, cada una en cualquier parte del texto.
   *
   * Con la frase entera, "ana cliente" no encontraría nada (el orden del texto
   * buscable es un detalle de implementación, no algo que alguien tenga que
   * adivinar); pidiendo todas las palabras, cada una que se agrega achica el
   * resultado, que es como se busca cuando hay muchas filas.
   */
  const visibles = useMemo(() => {
    const base = filasDeUsuarios(users, { sinAsignar: verSinAsignar, organizationId: orgSeleccionada });
    const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (terminos.length === 0) return base;
    return base.filter((u) => {
      const texto = textoBuscable(u, projects);
      return terminos.every((t) => texto.includes(t));
    });
  }, [users, projects, busqueda, verSinAsignar, orgSeleccionada]);
  const totalDeLaVista = useMemo(
    () => filasDeUsuarios(users, { sinAsignar: verSinAsignar, organizationId: orgSeleccionada }).length,
    [users, verSinAsignar, orgSeleccionada],
  );

  /* LA TABLA DE USUARIOS ES LA DEL TEMPLATE (`Tabla`), la misma que roles y
     miembros acá al lado. Tenerla distinta era la rareza: tres listados en una
     pantalla, dos con el ancho repartido, el menú de fila y la paginación del
     template, y el de usuarios —el más largo de los tres— con otra anatomía.

     `proyectos` es la elástica: es la única columna de largo impredecible —una
     persona puede tocar uno o quince— y es la que el template deja absorber el
     déficit de ancho. Las otras tres son acotadas y se declaran con su ideal. */
  /* Mirando una organización, la columna «Organización» repetiría el mismo
     nombre en cada fila: en su lugar van sus roles, EDITABLES. Es lo que hacía
     la tabla «Miembros» del panel de arriba, que mostraba a esta misma gente;
     dos tablas con las mismas filas hacían preguntar si eran cosas distintas. */
  const COLUMNAS_USUARIO: ColumnaDeTabla[] = [
    { id: 'username', label: 'Usuario', dato: 'username', w: 220, tip: true },
    { id: 'account_type', label: 'Tipo de cuenta', dato: 'account_type', w: 180 },
    verSinAsignar
      ? { id: 'organization', label: 'Organización', w: 280, orden: false }
      : { id: 'roles', label: 'Roles en la organización', w: 320, orden: false },
    { id: 'proyectos', label: 'Proyectos', w: 420, orden: false, elastica: true },
  ];

  /* Editar y Eliminar van al menú de fila y no a dos botones en una columna
     `actions`: es donde el template pone las acciones, y es lo que le da a la
     tabla su columna `__menu` con el objetivo táctil de 44px. */
  const menuDeUsuario = (u: UserSummary) => ({
    groups: [
      { items: [{ id: 'editar', label: 'Editar el usuario' }] },
      ...(!verSinAsignar && orgSeleccionada && u.organization
        ? [{ items: [{ id: 'sacar', label: 'Sacar de la organización', danger: true }] }]
        : []),
      { items: [{ id: 'eliminar', label: 'Eliminar el usuario', danger: true }] },
    ],
    onSelect: (id: string) => {
      if (id === 'editar') { setEditing(u); return; }
      if (id === 'sacar') {
        if (!orgSeleccionada) return;
        if (!window.confirm(`¿Sacar a '${u.username}' de la organización? La cuenta sigue existiendo, sin organización.`)) return;
        void cambiarMembresia(() => removeMember(orgSeleccionada, u.id), 'Error al sacar de la organización');
        return;
      }
      void handleDelete(u);
    },
  });

  function celdaDeUsuario(u: UserSummary, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'username') {
      return <span className="font-medium">{u.username}</span>;
    }
    if (c.id === 'account_type') {
      // "Rol" acá era la ambigüedad: este eje no es RBAC sino tenancy — quién
      // sos respecto del producto (el operador de la instalación, o gente de un
      // cliente). Los roles de verdad son los de organización y los de proyecto.
      return (
        <StatusBadge
          label={u.account_type === 'operator' ? 'Operador del producto' : 'Cliente'}
          tone={u.account_type === 'operator' ? 'info' : 'neutral'}
        />
      );
    }
    if (c.id === 'roles') {
      if (u.account_type === 'operator' || !orgSeleccionada) return <span className="text-xs opacity-70">No aplica</span>;
      return (
        <RolesDelMiembro
          roles={rolesOrg}
          asignados={u.organization?.roles ?? []}
          editable
          onCambiar={(ids) =>
            void cambiarMembresia(() => setMemberRoles(orgSeleccionada, u.id, ids), 'Error al cambiar los roles')
          }
        />
      );
    }
    if (c.id === 'organization') {
      // La columna que faltaba, y el motivo de unificar las dos pestañas: una
      // persona pertenece a UNA organización, así que es un atributo suyo. Sin
      // verlo acá, elegir a alguien para fundar o para sumar a otra terminaba en
      // un 409 al guardar, sin forma de anticiparlo.
      if (u.account_type === 'operator') {
        // No es un dato que falte: un operador opera el producto y por diseño
        // no es de ningún cliente. Mostrarlo como "sin organización" lo haría
        // parecer un estado a corregir.
        return <span className="text-xs opacity-70">No aplica</span>;
      }
      if (!u.organization) {
        return <StatusBadge label="Sin organización" tone="warning" />;
      }
      /* La organización es una, los roles son varios: un chip para la
         pertenencia y uno por rol. Sin roles se dice, porque es el estado que
         explica el 403 — pertenece y no puede nada. */
      return (
        <div className="flex flex-wrap gap-1">
          <StatusBadge label={u.organization.organization_name} tone="neutral" />
          {u.organization.roles.length === 0 ? (
            <StatusBadge label="sin roles" tone="warning" />
          ) : (
            u.organization.roles.map((r) => (
              <StatusBadge key={r.role_id} label={r.role_name ?? '(rol desconocido)'} tone="neutral" />
            ))
          )}
        </div>
      );
    }
    if (c.id === 'proyectos') {
      return u.account_type === 'operator' ? (
        <span className="text-xs opacity-70">Todos</span>
      ) : (
        <ProjectAccessBadges user={u} projects={projects} />
      );
    }
    return null;
  }

  return (
    // Fondo oscuro y no `bg-white`: es la superficie de la app
    // (`--app-bg`, la misma que el shell y que ChatContent). Lo que vive acá ya
    // estaba pensado para fondo oscuro y sobre blanco se veía mal — la `Tabla`
    // del template resuelve su propio tema por tokens (`--sw-tabla-*`), que es
    // lo que deja ponerla sobre esta superficie sin pedirle un fondo aparte.
    <div className="h-full overflow-y-auto bg-[var(--app-bg)]">
      {/* LA TOOLBAR DE LA SUPERFICIE (`ui/molecules/Toolbar.tsx`), a todo el
          ancho y pegada arriba —como en el template—, fuera del relleno de la
          página. A la izquierda, sobre qué organización se trabaja y las altas;
          a la derecha, sumar a esa organización a alguien que ya tiene cuenta.
          El filtro «sin asignar» NO va acá: filtra la tabla, y va con ella. */}
      <div className="sticky top-0 z-10">
        <Toolbar label="Usuarios">
          <ToolbarGrupo>
            <Combo
              rotulo="Organización"
              opciones={organizaciones.map((o) => ({ id: o.id, label: o.name }))}
              valor={orgSeleccionada ?? ''}
              alCambiar={(v) => alElegirOrganizacion(v || null)}
            />
          </ToolbarGrupo>
          <ToolbarGrupo>
            {/* Sólo el operador del producto funda organizaciones: es el alta de
                un cliente, no algo que un cliente se haga a sí mismo. */}
            {currentUser?.account_type === 'operator' && (
              <ToolbarBoton onClick={() => setCreandoOrg(true)}>+ Nueva organización</ToolbarBoton>
            )}
            <ToolbarBoton onClick={() => setEditing('new')}>+ Nuevo usuario</ToolbarBoton>
          </ToolbarGrupo>
          <ToolbarUtiles>
            {/* Sumar a alguien con cuenta y sin organización. Entra con UN rol;
                los demás se dan después con los chips de su fila. Sin nadie a
                quien sumar, el botón queda y dice por qué no hace nada. */}
            {orgSeleccionada && candidatos.length > 0 && rolesOrg.some((r) => r.scope === 'org') ? (
              <>
                <Combo
                  rotulo="Agregar usuario"
                  opciones={[{ id: '', label: 'Elegí a quién…' }, ...candidatos.map((u) => ({ id: u.id, label: u.username }))]}
                  valor={nuevoMiembro.userId}
                  alCambiar={(v) => setNuevoMiembro((n) => ({ ...n, userId: v }))}
                />
                <Combo
                  rotulo="con el rol"
                  opciones={[
                    { id: '', label: 'Elegí un rol…' },
                    ...rolesOrg.filter((r) => r.scope === 'org').map((r) => ({ id: r.id, label: r.name })),
                  ]}
                  valor={nuevoMiembro.roleId}
                  alCambiar={(v) => setNuevoMiembro((n) => ({ ...n, roleId: v }))}
                />
                <ToolbarBoton
                  primario
                  disabled={!nuevoMiembro.userId || !nuevoMiembro.roleId}
                  onClick={() => {
                    const { userId, roleId } = nuevoMiembro;
                    void cambiarMembresia(async () => {
                      await setMemberRoles(orgSeleccionada, userId, [roleId]);
                      setNuevoMiembro({ userId: '', roleId: '' });
                    }, 'Error al agregar a la organización');
                  }}
                >
                  Agregar
                </ToolbarBoton>
              </>
            ) : (
              <ToolbarBoton
                disabled
                title={
                  candidatos.length === 0
                    ? 'No hay nadie sin organización: todos los clientes ya pertenecen a una. Creá uno con «+ Nuevo usuario».'
                    : 'Esta organización no tiene roles de organización: creá uno para poder sumar gente.'
                }
              >
                Agregar usuario
              </ToolbarBoton>
            )}
          </ToolbarUtiles>
        </Toolbar>
      </div>

      <div className="p-6">
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-white">Configuración de la organización</h2>
        {orgSeleccionada && (
        <OrganizationRolesPanel
          users={users}
          organizacionFija={orgSeleccionada}
          // Agregar o quitar un miembro cambia la columna «Organización» de la
          // tabla de abajo: sin esto quedaría vieja hasta el próximo refresh.
          onMembersChanged={() => void refresh()}
          sinMiembros
          onRolesChanged={() => {
            setVersionRoles((v) => v + 1);
            void refresh();
          }}
        />
        )}
      </section>

      <section className="border-t border-white/10 pt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">
            {verSinAsignar ? 'Sin asignar' : 'Usuarios de la organización'}
          </h2>
          <div className="flex items-center gap-2">
            {/* EL NÚMERO ES LA RAZÓN DEL BOTÓN: dice de un vistazo si hay gente
                esperando organización sin abrir la lista. Va junto al buscador
                porque es lo mismo: un filtro de esta tabla. Los operadores salen
                en la lista pero no cuentan — no esperan nada. */}
            <button
              type="button"
              aria-pressed={verSinAsignar}
              onClick={() => setVerSinAsignar((v) => !v)}
              title="Clientes que no pertenecen a ninguna organización, y los operadores"
              className={`rounded-lg border px-3 py-2 text-sm ${
                verSinAsignar
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border text-secondary-foreground hover:bg-accent'
              }`}
            >
              {pendientes} sin asignar
            </button>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por usuario, organización, rol o proyecto…"
              className="w-72 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400"
            />
            {/* El contador sólo aparece filtrando: con la lista entera repetiría
                lo que ya se ve, y filtrando es el dato que falta —cuántas quedaron
                afuera— para no leer un resultado corto como "no hay más". */}
            {busqueda.trim() !== '' && (
              <span className="text-xs text-slate-400">
                {visibles.length} de {totalDeLaVista}
              </span>
            )}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : visibles.length === 0 && totalDeLaVista > 0 ? (
          <p className="text-sm text-slate-400">Ningún usuario coincide con «{busqueda.trim()}».</p>
        ) : (
          <Tabla<UserSummary>
            titulo="Usuarios"
            columnas={COLUMNAS_USUARIO}
            filas={visibles}
            clave={(u) => u.id}
            nombreFila={(u) => u.username}
            seleccion={false}
            menuFila={menuDeUsuario}
            celda={celdaDeUsuario}
            porPagina={25}
            opcionesPagina={[25, 50, 100]}
            /* EL VACÍO DICE LA CONSECUENCIA, no "no hay filas": sin usuarios no
               hay a quién darle un rol, y el alta está en el botón de arriba. */
            textos={
              verSinAsignar
                ? {
                    vacio: 'Nadie espera organización',
                    vacioPaso: 'Todos los clientes pertenecen a una organización.',
                  }
                : {
                    vacio: 'Esta organización todavía no tiene usuarios',
                    vacioPaso: 'Se suman con «Agregar usuario» acá abajo, o se crean con «+ Nuevo usuario».',
                  }
            }
          />
        )}
      </section>


      </div>

      {creandoOrg && (
        <OrganizationFormModal
          users={users}
          onClose={() => setCreandoOrg(false)}
          onCreated={(id) => {
            setCreandoOrg(false);
            void cargarOrganizaciones(id);
            // La organización nueva se lleva a su dueño adentro, así que la
            // columna «Organización» de la tabla cambió para esa persona.
            void refresh();
          }}
        />
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
