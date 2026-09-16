import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import {
  CatalogApiError,
  createModule,
  createPackage,
  createUtility,
  deleteModule,
  deletePackage,
  deleteUtility,
  esCompatible,
  listAssignments,
  listCatalogTools,
  listModules,
  listPackages,
  listUtilities,
  setModuleUtilities,
  setPackageModules,
  setProjectPackages,
} from '../lib/catalog-api.js';
import type { CatalogModule, CatalogPackage, CatalogToolOption, CatalogUtility } from '../lib/catalog-api.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';

const PANEL_CLASS = 'rounded-xl border border-white/10 bg-white/[0.03] p-4';
const INPUT_CLASS =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400 [&>option]:bg-[#221f1d] [&>option]:text-white';
const BOTON_PRIMARIO = 'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
const BOTON_SECUNDARIO = 'rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40';

function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof CatalogApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

/**
 * Alta de un elemento del catálogo. Los tres niveles comparten formulario
 * —nombre, slug opcional, descripción— porque comparten forma; la utilidad
 * agrega su tool y es la única diferencia.
 */
function AltaRapida({
  titulo,
  conTool,
  tools,
  onCrear,
}: {
  titulo: string;
  conTool?: boolean;
  tools?: CatalogToolOption[];
  onCrear: (input: { name: string; description: string | null; tool_name?: string | null }) => Promise<void>;
}): React.ReactElement {
  const [name, setName] = useState('');
  const [toolName, setToolName] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function crear(): Promise<void> {
    if (!name.trim()) return;
    setGuardando(true);
    try {
      await onCrear({ name: name.trim(), description: null, ...(conTool ? { tool_name: toolName || null } : {}) });
      setName('');
      setToolName('');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void crear();
        }}
        placeholder={titulo}
        className={`${INPUT_CLASS} w-56`}
      />
      {conTool && (
        <select value={toolName} onChange={(e) => setToolName(e.target.value)} className={`${INPUT_CLASS} w-64`}>
          <option value="">Sin tool todavía</option>
          {(tools ?? []).map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <button type="button" disabled={guardando || !name.trim()} onClick={() => void crear()} className={BOTON_PRIMARIO}>
        Agregar
      </button>
    </div>
  );
}

/**
 * La composición: qué hijos tiene el elegido, en una lista de casillas.
 *
 * Es el mismo control para las tres relaciones (módulos de un paquete,
 * utilidades de un módulo, proyectos de un paquete) porque las tres son lo
 * mismo: elegir un subconjunto de un catálogo y guardarlo COMPLETO. El guardado
 * es un reemplazo total, así que no hay que decir aparte qué se quitó.
 */
function Composicion<T extends { id: string; name: string }>({
  titulo,
  vacio,
  opciones,
  seleccionados,
  onGuardar,
  etiqueta,
}: {
  titulo: string;
  vacio: string;
  opciones: T[];
  seleccionados: string[];
  onGuardar: (ids: string[]) => Promise<void>;
  etiqueta?: (item: T) => React.ReactNode;
}): React.ReactElement {
  const [ids, setIds] = useState<string[]>(seleccionados);
  const [guardando, setGuardando] = useState(false);

  // Cambiar de elemento seleccionado tiene que traer SU composición: sin esto,
  // el estado local quedaría mostrando la del anterior y guardar la copiaría.
  useEffect(() => setIds(seleccionados), [seleccionados.join('|')]);

  const sucio = ids.join('|') !== seleccionados.join('|');

  function toggle(id: string): void {
    setIds((actual) => (actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</h3>
        <button
          type="button"
          disabled={!sucio || guardando}
          onClick={() => {
            setGuardando(true);
            void onGuardar(ids).finally(() => setGuardando(false));
          }}
          className={BOTON_SECUNDARIO}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {opciones.length === 0 ? (
        <p className="text-xs text-slate-500">{vacio}</p>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
          {opciones.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-slate-200 hover:bg-white/5">
              <input type="checkbox" checked={ids.includes(o.id)} onChange={() => toggle(o.id)} />
              <span className="flex-1 truncate">{etiqueta ? etiqueta(o) : o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Configuración del catálogo — paquetes, módulos y utilidades.
 *
 * Exclusiva del superadmin, igual que el backend: acá se define el producto que
 * después se le asigna a cada cliente. Un cliente no ve esta pantalla; ve el
 * resultado, que es su menú.
 *
 * Las tres secciones están en una sola página y no en tres porque configurar
 * uno de los niveles sin ver los otros dos es adivinar: el paquete se arma con
 * módulos que hay que poder crear ahí mismo, y el módulo con utilidades.
 */
export function CatalogPage(): React.ReactElement {
  const { user } = useAuth();
  const [packages, setPackages] = useState<CatalogPackage[]>([]);
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [utilities, setUtilities] = useState<CatalogUtility[]>([]);
  const [tools, setTools] = useState<CatalogToolOption[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [packageId, setPackageId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const [p, m, u, t, proj, asg] = await Promise.all([
        listPackages(),
        listModules(),
        listUtilities(),
        listCatalogTools(),
        listProjects(),
        listAssignments(),
      ]);
      setPackages(p);
      setModules(m);
      setUtilities(u);
      setTools(t);
      setProjects(proj);
      setAssignments(asg);
      setPackageId((actual) => actual ?? p[0]?.id ?? null);
      setModuleId((actual) => actual ?? m[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, 'Error al cargar el catálogo'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function conManejoDeError(accion: () => Promise<unknown>): Promise<void> {
    setError(null);
    try {
      await accion();
      await refresh();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar'));
    }
  }

  const paquete = useMemo(() => packages.find((p) => p.id === packageId) ?? null, [packages, packageId]);
  const modulo = useMemo(() => modules.find((m) => m.id === moduleId) ?? null, [modules, moduleId]);

  // El superadmin es el único que configura el producto. Un cliente que llegue
  // por URL se va al inicio, no ve una pantalla vacía.
  if (user && user.account_type !== 'operator') return <Navigate to="/" replace />;

  return (
    <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-white">Paquetes, módulos y utilidades</h1>
      </div>
      <p className="mb-4 max-w-3xl text-xs text-slate-400">
        Un paquete contiene módulos y un módulo contiene utilidades. Nada de eso viene dado: se arma acá y se le asigna
        a cada proyecto, y eso es lo que termina siendo su menú.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <section className={PANEL_CLASS}>
            <h2 className="text-sm font-semibold text-white">Paquetes</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {packages.length === 0 && <p className="px-1 py-2 text-xs text-slate-500">Todavía no hay paquetes.</p>}
                  {packages.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        p.id === packageId ? 'bg-indigo-500/20 text-white' : 'text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <button type="button" onClick={() => setPackageId(p.id)} className="flex-1 truncate text-left">
                        {p.name}
                        <span className="ml-2 text-xs text-slate-400">{p.modules.length} módulos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`¿Eliminar el paquete '${p.name}'? Los módulos no se borran.`)) return;
                          void conManejoDeError(async () => {
                            await deletePackage(p.id);
                            if (packageId === p.id) setPackageId(null);
                          });
                        }}
                        className="rounded px-1 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
                <AltaRapida
                  titulo="Nombre del paquete"
                  onCrear={async (input) => {
                    await conManejoDeError(() => createPackage(input));
                  }}
                />
              </div>

              {paquete ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Composicion
                    titulo={`Módulos de ${paquete.name}`}
                    vacio="Creá un módulo abajo para poder ponerlo en este paquete."
                    opciones={modules}
                    seleccionados={paquete.modules.map((m) => m.id)}
                    onGuardar={(ids) => conManejoDeError(() => setPackageModules(paquete.id, ids))}
                  />
                  <Composicion
                    titulo="Proyectos que lo tienen"
                    vacio="No hay proyectos."
                    opciones={projects.map((p) => ({ id: p.id, name: p.name }))}
                    seleccionados={assignments[paquete.id] ?? []}
                    onGuardar={async (ids) => {
                      // La asignación se guarda por PROYECTO (es lo que el
                      // backend expone), así que un cambio acá puede tocar
                      // varios: se recalcula la lista de cada uno afectado.
                      const antes = new Set(assignments[paquete.id] ?? []);
                      const ahora = new Set(ids);
                      const tocados = [...new Set([...antes, ...ahora])].filter(
                        (projectId) => antes.has(projectId) !== ahora.has(projectId),
                      );
                      await conManejoDeError(async () => {
                        for (const projectId of tocados) {
                          const actuales = Object.entries(assignments)
                            .filter(([, proyectos]) => proyectos.includes(projectId))
                            .map(([pkgId]) => pkgId);
                          const nuevos = ahora.has(projectId)
                            ? [...new Set([...actuales, paquete.id])]
                            : actuales.filter((pkgId) => pkgId !== paquete.id);
                          await setProjectPackages(projectId, nuevos);
                        }
                      });
                    }}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-500">Elegí un paquete para configurarlo.</p>
              )}
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <h2 className="text-sm font-semibold text-white">Módulos</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {modules.length === 0 && <p className="px-1 py-2 text-xs text-slate-500">Todavía no hay módulos.</p>}
                  {modules.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        m.id === moduleId ? 'bg-indigo-500/20 text-white' : 'text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <button type="button" onClick={() => setModuleId(m.id)} className="flex-1 truncate text-left">
                        {m.name}
                        <span className="ml-2 text-xs text-slate-400">{m.utilities.length} utilidades</span>
                        {/* De dónde salió la fila. Un módulo `code` lo declara el
                            código y tiene vista; uno `manual` sirve para diseñar
                            el menú pero no resuelve nada todavía. */}
                        {m.origin === 'code' && <span className="ml-2 text-xs text-emerald-400">código</span>}
                        {m.status === 'missing' && <span className="ml-2 text-xs text-amber-400">ya no existe en el código</span>}
                      </button>
                      <button
                        type="button"
                        // Un módulo del código no se borra desde acá: el próximo
                        // arranque lo recrearía, y el botón mentiría.
                        disabled={m.origin === 'code'}
                        title={m.origin === 'code' ? 'Lo declara el código: se va cuando se lo saque de ahí' : undefined}
                        onClick={() => {
                          if (!window.confirm(`¿Eliminar el módulo '${m.name}'?`)) return;
                          void conManejoDeError(async () => {
                            await deleteModule(m.id);
                            if (moduleId === m.id) setModuleId(null);
                          });
                        }}
                        className="rounded px-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
                <AltaRapida
                  titulo="Nombre del módulo"
                  onCrear={async (input) => {
                    await conManejoDeError(() => createModule(input));
                  }}
                />
              </div>

              {modulo ? (
                <Composicion
                  titulo={`Utilidades de ${modulo.name}`}
                  vacio={
                    utilities.length === 0
                      ? 'Creá una utilidad abajo para poder ponerla en este módulo.'
                      : 'Ninguna utilidad es compatible con este módulo. Una utilidad declara con qué módulos sirve; las abiertas sólo entran si el módulo acepta abiertas.'
                  }
                  // Sólo las compatibles: ofrecer una que el backend va a
                  // rechazar hace perder el tiempo y enseña mal el modelo.
                  opciones={utilities.filter((u) => esCompatible(u, modulo))}
                  seleccionados={modulo.utilities.map((u) => u.id)}
                  onGuardar={(ids) => conManejoDeError(() => setModuleUtilities(modulo.id, ids))}
                  etiqueta={(u) => {
                    const util = utilities.find((x) => x.id === u.id);
                    return (
                      <span className="flex items-center gap-2">
                        {u.name}
                        {util?.tool_name ? (
                          <span className="text-xs text-slate-400">{util.tool_name}</span>
                        ) : (
                          <StatusBadge label="sin tool" tone="warning" />
                        )}
                      </span>
                    );
                  }}
                />
              ) : (
                <p className="text-xs text-slate-500">Elegí un módulo para configurarlo.</p>
              )}
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <h2 className="text-sm font-semibold text-white">Utilidades</h2>
            <p className="mt-1 text-xs text-slate-400">
              Una utilidad es la presentación de una tool que ya existe. Puede declararse antes que su tool: mientras
              tanto se muestra, pero no ejecuta nada.
            </p>
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
              {utilities.length === 0 && <p className="px-1 py-2 text-xs text-slate-500">Todavía no hay utilidades.</p>}
              {utilities.map((u) => (
                <div key={u.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-white/5">
                  <span className="flex-1 truncate">
                    {u.name}
                    {u.origin === 'code' && <span className="ml-2 text-xs text-emerald-400">código</span>}
                    {u.status === 'missing' && <span className="ml-2 text-xs text-amber-400">ya no existe en el código</span>}
                    {/* La compatibilidad es lo que decide en qué módulos se puede
                        colgar, así que se ve en la lista y no sólo al componer. */}
                    <span className="ml-2 text-xs text-slate-500">
                      {u.compatible_with === '*'
                        ? 'abierta'
                        : Array.isArray(u.compatible_with)
                          ? `cerrada a ${u.compatible_with.join(', ')}`
                          : 'sin compatibilidad declarada'}
                    </span>
                  </span>
                  {u.tool_name ? (
                    <StatusBadge label={u.tool_name} tone="neutral" />
                  ) : (
                    <StatusBadge label="sin tool" tone="warning" />
                  )}
                  <button
                    type="button"
                    disabled={u.origin === 'code'}
                    title={u.origin === 'code' ? 'La declara el código: se va cuando se la saque de ahí' : undefined}
                    onClick={() => {
                      if (!window.confirm(`¿Eliminar la utilidad '${u.name}'?`)) return;
                      void conManejoDeError(() => deleteUtility(u.id));
                    }}
                    className="rounded px-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
            <AltaRapida
              titulo="Nombre de la utilidad"
              conTool
              tools={tools}
              onCrear={async (input) => {
                await conManejoDeError(() => createUtility(input));
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}
