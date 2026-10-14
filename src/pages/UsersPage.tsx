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
import { Toolbar, ToolbarBoton, ToolbarGrupo } from '../components/ui/molecules/Toolbar.js';
import { Combo } from '../components/ui/Combo.js';
import { Icon } from '../components/Icon.js';
import { CampoClave } from '../components/ui/CampoClave.js';
import { Dialogo } from '../components/ui/Dialogo.js';
import { ChipDeGrupo } from '../components/ui/ChipDeGrupo.js';
import { Button } from '../components/ui/atoms/Button.js';
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
  /* UN CHIP POR PROYECTO con sus roles adentro (`ChipDeGrupo`), no uno por cada
     par proyecto·rol: así se lee de un vistazo cuántos roles tiene en cada uno
     sin contar chips que repiten el nombre del proyecto. */
  const porProyecto = new Map<string, string[]>();
  for (const a of user.project_roles) {
    porProyecto.set(a.project_id, [...(porProyecto.get(a.project_id) ?? []), a.role_name]);
  }
  const porOrganizacion = user.project_ids.filter((id) => !porProyecto.has(id));

  if (porProyecto.size === 0 && porOrganizacion.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin proyectos asignados</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 py-1.5 whitespace-normal">
      {[...porProyecto].map(([id, roles]) => (
        <ChipDeGrupo key={id} rotulo={nombreDe(id)} items={roles} title={`${nombreDe(id)}: ${roles.join(', ')}`} />
      ))}
      {/* Lo que ve por su rol de organización y no por una asignación propia:
          neutro, porque este formulario no lo administra. */}
      {porOrganizacion.map((id) => (
        <ChipDeGrupo
          key={id}
          rotulo={nombreDe(id)}
          items={['por organización']}
          neutro
          title="Lo ve por su rol de organización, no por una asignación en el proyecto"
        />
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
  /* La organización se elige al dar el alta, o al editar a alguien que todavía
     no tiene: ésa es la forma de asignar a los «sin asignar». A quien ya
     pertenece a una no se lo muda desde acá. */
  const puedeElegirOrganizacion = !editing || !editing.organization;
  /** Qué proyecto tiene abierto el recuadro de roles (uno a la vez). */
  const [editandoProyecto, setEditandoProyecto] = useState<string | null>(null);
  const idsAsignados = new Set(form.project_roles.map((a) => a.project_id));
  /* El que se está editando sigue en la lista aunque se le saquen todos los
     roles: si desapareciera al destildar el último, no habría dónde volver a
     marcar uno. Al cerrarlo sin roles, deja de estar asignado. */
  const asignados = projects.filter((p) => idsAsignados.has(p.id) || p.id === editandoProyecto);
  /* Lo que se puede agregar: lo que no tiene todavía y cuya organización tiene
     roles de proyecto. Un proyecto sin ellos no se ofrece —el backend lo
     rechazaría— y se dice cuántos quedaron afuera y por qué. */
  const sinAsignar = projects.filter((p) => !idsAsignados.has(p.id));
  const asignables = sinAsignar.filter((p) => rolesAsignables(p, rolesPorOrg).length > 0);
  const sinRolesDeProyecto = rolesListos ? sinAsignar.length - asignables.length : 0;

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

  async function handleSubmit(): Promise<void> {
    setError(null);
    setSaving(true);
    try {
      if (form.account_type === 'client' && puedeElegirOrganizacion && form.organization_id && !form.organization_role_id) {
        throw new Error('Elegí con qué rol entra a la organización');
      }
      if (editing) {
        await updateUser(editing.id, {
          account_type: form.account_type,
          password: form.password || undefined,
          project_roles: form.project_roles,
        });
        /* Asignar a alguien sin organización. El PATCH de usuarios no la toca
           (mudar de organización tiene su propio invariante de gobierno), así
           que va por la membresía: el mismo camino que sumarlo desde la tabla. */
        if (form.account_type === 'client' && !editing.organization && form.organization_id) {
          await setMemberRoles(form.organization_id, editing.id, [form.organization_role_id]);
        }
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

  /* Un campo: su rótulo arriba y el control. Agrupados con `gap` y no con
     márgenes, que el reset del template anula. */
  const campo = (rotulo: React.ReactNode, control: React.ReactNode, ayuda?: React.ReactNode): React.ReactElement => (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      {control}
      {ayuda ? <span className="text-xs text-muted-foreground">{ayuda}</span> : null}
    </label>
  );

  return (
    <Dialogo
      abierto
      onCerrar={onClose}
      titulo={editing ? 'Editar usuario' : 'Nuevo usuario'}
      onSubmit={() => void handleSubmit()}
      // Las credenciales de ESTE formulario son de OTRA persona: sin esto el
      // navegador lo toma por un login y completa el usuario y la clave
      // guardados de quien está dando el alta (y ofrece guardarlos).
      autoComplete="off"
      ancho={520}
      pie={
        <>
          <button type="button" className="btn" data-variant="outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <div className="rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-xs text-[var(--sw-on-error)]">
            {error}
          </div>
        )}

        {campo(
          'Usuario',
          <input
            type="text"
            name="nuevo-usuario"
            autoComplete="off"
            className="input w-full"
            value={form.username}
            disabled={!!editing}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />,
        )}

        {campo(
          editing ? 'Nueva contraseña (opcional)' : 'Contraseña',
          <CampoClave
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            className="input w-full"
          />,
        )}

        {/* DOS VALORES, UN INTERRUPTOR: el switch de Basecoat que el tema ya
            estila (basecoat-ext.css). Apagado es cliente —lo normal—, encendido
            es operar la instalación entera. */}
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Tipo de cuenta</span>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              role="switch"
              className="input"
              checked={form.account_type === 'operator'}
              onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.checked ? 'operator' : 'client' }))}
            />
            <span>
              {form.account_type === 'operator' ? 'Operador del producto' : 'Cliente'}
              <span className="block text-xs text-muted-foreground">
                {form.account_type === 'operator'
                  ? 'Opera la instalación entera: ve y administra todo, sin roles.'
                  : 'Gente de una organización: puede lo que le den sus roles.'}
              </span>
            </span>
          </label>
        </div>

        {form.account_type === 'client' &&
          puedeElegirOrganizacion &&
          campo(
            'Organización',
            <select
              className="select w-full"
              value={form.organization_id}
              onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value, organization_role_id: '' }))}
            >
              {/* Al dar el alta, sin organización es «una propia»; al editar a
                  alguien sin asignar, es dejarlo como está. */}
              <option value="">{editing ? 'Sin organización (como está)' : 'Una organización propia'}</option>
              {organizaciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>,
          )}

        {form.account_type === 'client' &&
          puedeElegirOrganizacion &&
          form.organization_id &&
          campo(
            'Rol en la organización',
            <select
              className="select w-full"
              value={form.organization_role_id}
              onChange={(e) => setForm((f) => ({ ...f, organization_role_id: e.target.value }))}
            >
              <option value="">Elegí un rol</option>
              {(rolesPorOrg[form.organization_id] ?? [])
                .filter((r) => r.scope === 'org')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>,
            'El rol de organización delimita: administra miembros, roles y auditoría. Lo que la persona puede hacer en cada proyecto sale del rol que se le dé abajo.',
          )}

        {form.account_type === 'client' && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Proyectos y sus roles</span>
              {/* UNA LISTA QUE SE DESPLIEGA, no una lista de casillas: una persona
                  tiene pocos proyectos de muchos posibles, y la lista entera
                  tildada escondía cuáles tenía entre los que no. Es el combo del
                  template —con scroll y búsqueda al teclear—, porque los
                  proyectos pueden ser decenas. Elegir uno lo agrega y el combo
                  vuelve a «Agregar proyecto». */}
              {rolesListos && asignables.length > 0 ? (
                <Combo
                  rotulo=""
                  opciones={[{ id: '', label: '+ Agregar proyecto' }, ...asignables.map((p) => ({ id: p.id, label: p.name }))]}
                  valor=""
                  alCambiar={(id) => {
                    const p = projects.find((x) => x.id === id);
                    if (!p) return;
                    toggleProject(p);
                    // El recién agregado entra abierto: lo siguiente es elegirle roles.
                    setEditandoProyecto(p.id);
                  }}
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {rolesListos ? 'Ya tiene todos los proyectos que se pueden asignar' : 'Cargando…'}
                </span>
              )}
            </div>

            {asignados.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
                {rolesListos ? 'Sin proyectos: no va a ver ninguno.' : 'Cargando roles…'}
              </p>
            ) : (
              <ul className="grid gap-2">
                {asignados.map((p) => {
                  const deEsteProyecto = form.project_roles.filter((a) => a.project_id === p.id);
                  const disponibles = rolesAsignables(p, rolesPorOrg);
                  const nombres = deEsteProyecto.map((a) => disponibles.find((r) => r.id === a.role_id)?.name ?? '(rol desconocido)');
                  const abierto = editandoProyecto === p.id;
                  return (
                    <li key={p.id} className="rounded-lg border border-border">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <span className="min-w-0 flex-1">
                          <ChipDeGrupo rotulo={p.name} items={nombres} />
                        </span>
                        {/* Un proyecto sin roles queda asignado y sin poder nada:
                            se dice, porque después es un 403 que nadie entiende. */}
                        {deEsteProyecto.length === 0 ? (
                          <span className="text-[11px] text-[var(--sw-warning)]">sin roles — no podrá entrar</span>
                        ) : null}
                        <Button variant="ghost" aria-expanded={abierto} onClick={() => setEditandoProyecto(abierto ? null : p.id)}>
                          {abierto ? 'Listo' : 'Editar'}
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-[var(--sw-error)]"
                          onClick={() => {
                            toggleProject(p);
                            if (abierto) setEditandoProyecto(null);
                          }}
                        >
                          Quitar
                        </Button>
                      </div>
                      {/* LOS ROLES SE EDITAN DE A UN PROYECTO: el recuadro con todos
                          los posibles aparece sólo en el que se está editando.
                          VARIOS ROLES POR PROYECTO, no un select: los permisos son
                          la unión, así que «Contable» + «Colaborador» en el mismo
                          proyecto es el caso normal. */}
                      {abierto && (
                        <div className="flex flex-wrap gap-1 border-t border-border px-2 py-2">
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
                                    ? 'border-transparent bg-primary text-primary-foreground'
                                    : 'border-border text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {r.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {sinRolesDeProyecto > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {sinRolesDeProyecto === 1 ? 'Un proyecto no aparece' : `${sinRolesDeProyecto} proyectos no aparecen`} en la
                lista: su organización no tiene roles de proyecto. Creá uno en «Roles» para poder asignarlos.
              </p>
            )}
          </div>
        )}
      </div>
    </Dialogo>
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
  /* Anchos en proporción 20 · 10 · 20 · 50: el que sobra se reparte según el
     ideal de cada una, así que estos números SON los porcentajes. Tipo de cuenta
     y rol de organización llevan un valor corto; los proyectos, varios chips.

     «Rol de nivel organización» y no «Roles en la organización»: los roles de
     proyecto también son de la organización (los define ella), así que el
     rótulo viejo no decía cuál de los dos era. Éste dice el alcance. */
  const COLUMNAS_USUARIO: ColumnaDeTabla[] = [
    { id: 'username', label: 'Usuario', dato: 'username', w: 200, tip: true },
    { id: 'account_type', label: 'Tipo de cuenta', dato: 'account_type', w: 100 },
    verSinAsignar
      ? { id: 'organization', label: 'Organización', w: 200, orden: false }
      : { id: 'roles', label: 'Rol de nivel organización', w: 200, orden: false },
    { id: 'proyectos', label: 'Proyectos y sus roles', w: 500, orden: false, elastica: true },
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
      /* «Operador» y no «Operador del producto»: la columna es angosta (10%) y
         el rótulo largo se cortaba. Lo largo queda en el title. */
      return (
        <span title={u.account_type === 'operator' ? 'Operador del producto: opera la instalación entera' : 'Cliente: gente de una organización'}>
          <StatusBadge
            label={u.account_type === 'operator' ? 'Operador' : 'Cliente'}
            tone={u.account_type === 'operator' ? 'info' : 'neutral'}
          />
        </span>
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
          </ToolbarGrupo>
        </Toolbar>
      </div>

      <div className="p-6">
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <section className="mb-8">
        {orgSeleccionada && (
        <OrganizationRolesPanel
          organizacionFija={orgSeleccionada}
          sinMiembros
          onRolesChanged={() => {
            setVersionRoles((v) => v + 1);
            void refresh();
          }}
        />
        )}
      </section>

      {/* `gap` y no `mb-*` entre el encabezado y la tabla: el reset del template
          (`theme/base.css`, fuera de las capas de Tailwind) les gana a las
          utilidades de margen, y `mb-4` medía 0. */}
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-sm font-semibold text-foreground">
            {verSinAsignar
              ? 'Sin asignar'
              : `Usuarios de ${organizaciones.find((o) => o.id === orgSeleccionada)?.name ?? 'la organización'}`}
          </h2>
            {/* El alta va junto a la tabla en la que aparece la persona. Para
                asignar a alguien que ya tiene cuenta y está «sin asignar», se lo
                edita desde su fila y se le elige la organización. */}
            <Button variant="outline" onClick={() => setEditing('new')}>
              Agregar usuario
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {/* EL NÚMERO ES LA RAZÓN DEL BOTÓN: dice de un vistazo si hay gente
                esperando organización sin abrir la lista. Va junto al buscador
                porque es lo mismo: un filtro de esta tabla. Los operadores salen
                en la lista pero no cuentan — no esperan nada. */}
            {/* Un link y no un botón con caja: al lado del buscador, una caja
                más competía con él y con el borde de la tabla. Va a su
                IZQUIERDA: el rótulo cambia al encenderse («Viendo N sin
                asignar») y así crece hacia afuera sin correr al buscador. */}
            <button
              type="button"
              className={`btn inline-flex items-center gap-1.5 ${verSinAsignar ? 'text-primary' : 'text-secondary-foreground'}`}
              data-variant="link"
              data-size="sm"
              aria-pressed={verSinAsignar}
              onClick={() => setVerSinAsignar((v) => !v)}
              title="Clientes que no pertenecen a ninguna organización, y los operadores"
            >
              {/* El ícono dice que es un FILTRO de la tabla y no una acción. */}
              <Icon name="filter" />
              {verSinAsignar ? `Viendo ${pendientes} sin asignar` : `${pendientes} sin asignar`}
            </button>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por usuario, organización, rol o proyecto…"
              className="w-72 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
            {/* El contador sólo aparece filtrando: con la lista entera repetiría
                lo que ya se ve, y filtrando es el dato que falta —cuántas quedaron
                afuera— para no leer un resultado corto como "no hay más". */}
            {busqueda.trim() !== '' && (
              <span className="text-xs text-muted-foreground">
                {visibles.length} de {totalDeLaVista}
              </span>
            )}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
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
              /* La búsqueda sin resultados usa el vacío de la tabla —su fila con
                 el motivo y el paso siguiente— y no un párrafo suelto en lugar
                 de la tabla: se ve igual que cualquier otro vacío y la cabecera
                 queda, así que se entiende qué se filtró. */
              busqueda.trim() !== '' && totalDeLaVista > 0
                ? {
                    vacio: `Ningún usuario coincide con «${busqueda.trim()}»`,
                    vacioPaso: 'Se busca por usuario, organización, rol o proyecto. Probá con menos palabras.',
                  }
                : verSinAsignar
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
