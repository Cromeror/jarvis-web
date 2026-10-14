import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import {
  CatalogApiError,
  createModule,
  createSuite,
  createModuleTool,
  deleteModule,
  deleteSuite,
  deleteModuleTool,
  esCompatible,
  listAssignments,
  listCatalogTools,
  listModules,
  listSuites,
  listModuleTools,
  setModuleTools as asignarHerramientasAlModulo,
  setSuiteModules,
  setProjectSuites,
} from '../lib/catalog-api.js';
import type { CatalogModule, CatalogSuite, CatalogToolOption, CatalogModuleTool } from '../lib/catalog-api.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';
import { fichaDeModulo, nombreDistinguible, paraQuienDe } from '../lib/ficha-de-modulo.js';

const PANEL_CLASS = 'rounded-xl border border-border bg-muted p-4';
const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary [&>option]:bg-popover [&>option]:text-popover-foreground';
const BOTON_PRIMARIO =
  'rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50';
const BOTON_SECUNDARIO =
  'rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-40';

const PASTILLA = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none';

/**
 * Para quién es y dónde aparece, en dos pastillas. Van en cada fila porque es
 * lo único que separa dos módulos con el mismo nombre (`ficha-de-modulo.ts`).
 */
function EjesDelModulo({ m }: { m: CatalogModule }): React.ReactElement {
  const deOrg = paraQuienDe(m) === 'organizacion';
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span
        className={`${PASTILLA} ${deOrg ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted text-secondary-foreground'}`}
        title={
          deOrg
            ? 'Catálogo de organización: lo usa la organización como tal'
            : 'Catálogo de espacio: lo usa el equipo de un espacio'
        }
      >
        {deOrg ? 'Organización' : 'Espacio'}
      </span>
      <span className={`${PASTILLA} border-border text-muted-foreground`} title="Dónde se muestra">
        {m.superficie === 'ajustes' ? 'Ajustes' : 'Riel'}
      </span>
    </span>
  );
}

/** El código del módulo, o un aviso si es manual y todavía no lo tiene. */
function CodigoDelModulo({ m }: { m: CatalogModule }): React.ReactElement {
  return m.key ? (
    <code className="shrink-0 text-[11px] text-muted-foreground">{m.key}</code>
  ) : (
    <span className="shrink-0 text-[11px] italic text-muted-foreground" title="Módulo manual: no lo declara el código">
      sin código
    </span>
  );
}

/**
 * LA FICHA del módulo elegido: qué es cada uno de los dos ejes para ESTE
 * módulo, y por qué suites le llega a alguien. Responde «¿a dónde va y de quién
 * es?» sin tener que conocer el modelo.
 */
function FichaDelModulo({ m, suites }: { m: CatalogModule; suites: CatalogSuite[] }): React.ReactElement {
  const f = fichaDeModulo(m, suites);
  const fila = (rotulo: string, valor: React.ReactNode): React.ReactElement => (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm text-foreground">{valor}</dd>
    </div>
  );
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
        <CodigoDelModulo m={m} />
        <EjesDelModulo m={m} />
      </div>
      <dl className="divide-y divide-border">
        {fila(
          'Para quién',
          <>
            <span className="font-medium">{f.paraQuienCorto}.</span> {f.quienLoUsa}
          </>,
        )}
        {fila('Dónde aparece', f.dondeAparece)}
        {fila(
          'Lo traen',
          f.suites.length > 0 ? f.suites.join(', ') : <span className="text-muted-foreground">ninguna suite</span>,
        )}
        {fila('Cómo llega', f.comoLlega)}
        {fila('Origen', m.origin === 'code' ? 'Lo declara el código' : 'Creado a mano en esta pantalla')}
      </dl>
    </div>
  );
}

function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof CatalogApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

/**
 * Alta de un elemento del catálogo. Los tres niveles comparten formulario
 * —nombre, slug opcional, descripción— porque comparten forma; la herramienta
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
      <button
        type="button"
        disabled={guardando || !name.trim()}
        onClick={() => void crear()}
        className={BOTON_PRIMARIO}
      >
        Agregar
      </button>
    </div>
  );
}

/**
 * La composición: qué hijos tiene el elegido, en una lista de casillas.
 *
 * Es el mismo control para las tres relaciones (módulos de una suite,
 * herramientas de un módulo, proyectos de una suite) porque las tres son lo
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
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
        <p className="text-xs text-muted-foreground">{vacio}</p>
      ) : (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {opciones.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-secondary-foreground hover:bg-accent"
            >
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
 * Configuración del catálogo — suites, módulos y herramientas.
 *
 * Exclusiva del superadmin, igual que el backend: acá se define el producto que
 * después se le asigna a cada cliente. Un cliente no ve esta pantalla; ve el
 * resultado, que es su menú.
 *
 * Las tres secciones están en una sola página y no en tres porque configurar
 * uno de los niveles sin ver los otros dos es adivinar: la suite se arma con
 * módulos que hay que poder crear ahí mismo, y el módulo con herramientas.
 */
export function CatalogPage(): React.ReactElement {
  const { user } = useAuth();
  const [suites, setSuites] = useState<CatalogSuite[]>([]);
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [moduleTools, setModuleTools] = useState<CatalogModuleTool[]>([]);
  const [tools, setTools] = useState<CatalogToolOption[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const [p, m, u, t, proj, asg] = await Promise.all([
        listSuites(),
        listModules(),
        listModuleTools(),
        listCatalogTools(),
        listProjects(),
        listAssignments(),
      ]);
      setSuites(p);
      setModules(m);
      setModuleTools(u);
      setTools(t);
      setProjects(proj);
      setAssignments(asg);
      setSuiteId((actual) => actual ?? p[0]?.id ?? null);
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

  const suite = useMemo(() => suites.find((p) => p.id === suiteId) ?? null, [suites, suiteId]);
  const modulo = useMemo(() => modules.find((m) => m.id === moduleId) ?? null, [modules, moduleId]);

  // El superadmin es el único que configura el producto. Un cliente que llegue
  // por URL se va al inicio, no ve una pantalla vacía.
  if (user && user.account_type !== 'operator') return <Navigate to="/" replace />;

  return (
    <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-foreground">Suites, módulos y herramientas</h1>
      </div>
      <p className="mb-4 max-w-3xl text-xs text-muted-foreground">
        Una suite contiene módulos y un módulo contiene herramientas. Nada de eso viene dado: se arma acá y se le asigna
        a cada proyecto, y eso es lo que termina siendo su menú.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <section className={PANEL_CLASS}>
            <h2 className="text-sm font-semibold text-foreground">Suites</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {suites.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Todavía no hay suites.</p>}
                  {suites.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        p.id === suiteId ? 'bg-primary/15 text-foreground' : 'text-secondary-foreground hover:bg-accent'
                      }`}
                    >
                      <button type="button" onClick={() => setSuiteId(p.id)} className="flex-1 truncate text-left">
                        {p.name}
                        <span className="ml-2 text-xs text-muted-foreground">{p.modules.length} módulos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`¿Eliminar la suite '${p.name}'? Los módulos no se borran.`)) return;
                          void conManejoDeError(async () => {
                            await deleteSuite(p.id);
                            if (suiteId === p.id) setSuiteId(null);
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
                  titulo="Nombre de la suite"
                  onCrear={async (input) => {
                    await conManejoDeError(() => createSuite(input));
                  }}
                />
              </div>

              {suite ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Composicion
                    titulo={`Módulos de ${suite.name}`}
                    vacio="Creá un módulo abajo para poder ponerlo en esta suite."
                    opciones={modules}
                    seleccionados={suite.modules.map((m) => m.id)}
                    onGuardar={(ids) => conManejoDeError(() => setSuiteModules(suite.id, ids))}
                    etiqueta={(m) => (
                      <span className="flex items-center gap-2">
                        <span className="truncate">{nombreDistinguible(m, modules)}</span>
                        <CodigoDelModulo m={m} />
                        <EjesDelModulo m={m} />
                      </span>
                    )}
                  />
                  <Composicion
                    titulo="Proyectos que la tienen"
                    vacio="No hay proyectos."
                    opciones={projects.map((p) => ({ id: p.id, name: p.name }))}
                    seleccionados={assignments[suite.id] ?? []}
                    onGuardar={async (ids) => {
                      // La asignación se guarda por PROYECTO (es lo que el
                      // backend expone), así que un cambio acá puede tocar
                      // varios: se recalcula la lista de cada uno afectado.
                      const antes = new Set(assignments[suite.id] ?? []);
                      const ahora = new Set(ids);
                      const tocados = [...new Set([...antes, ...ahora])].filter(
                        (projectId) => antes.has(projectId) !== ahora.has(projectId),
                      );
                      await conManejoDeError(async () => {
                        for (const projectId of tocados) {
                          const actuales = Object.entries(assignments)
                            .filter(([, proyectos]) => proyectos.includes(projectId))
                            .map(([suiteId]) => suiteId);
                          const nuevos = ahora.has(projectId)
                            ? [...new Set([...actuales, suite.id])]
                            : actuales.filter((otraId) => otraId !== suite.id);
                          await setProjectSuites(projectId, nuevos);
                        }
                      });
                    }}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Elegí una suite para configurarla.</p>
              )}
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <h2 className="text-sm font-semibold text-foreground">Módulos</h2>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Cada módulo es para <span className="font-medium text-foreground">un espacio</span> (lo usa el equipo que
              trabaja en él) o para <span className="font-medium text-foreground">la organización</span> (lo usa quien
              la administra), y se muestra en el <span className="font-medium text-foreground">riel</span> o en{' '}
              <span className="font-medium text-foreground">Ajustes</span>. Los dos se venden igual: por suite. Los del
              operador (la instalación) no se venden y por eso no están en esta lista.
            </p>
            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {modules.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Todavía no hay módulos.</p>}
                  {modules.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                        m.id === moduleId ? 'bg-primary/15 text-foreground' : 'text-secondary-foreground hover:bg-accent'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setModuleId(m.id)}
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left"
                      >
                        <span className="truncate">{nombreDistinguible(m, modules)}</span>
                        <CodigoDelModulo m={m} />
                        <EjesDelModulo m={m} />
                        <span className="text-xs text-muted-foreground">{m.module_tools.length} herramientas</span>
                        {/* De dónde salió la fila. Un módulo `code` lo declara el
                            código y tiene vista; uno `manual` sirve para diseñar
                            el menú pero no resuelve nada todavía. */}
                        {m.origin === 'code' && <span className="ml-2 text-xs text-emerald-400">código</span>}
                        {m.status === 'missing' && (
                          <span className="ml-2 text-xs text-amber-400">ya no existe en el código</span>
                        )}
                      </button>
                      <button
                        type="button"
                        // Un módulo del código no se borra desde acá: el próximo
                        // arranque lo recrearía, y el botón mentiría.
                        disabled={m.origin === 'code'}
                        title={
                          m.origin === 'code' ? 'Lo declara el código: se va cuando se lo saque de ahí' : undefined
                        }
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
                <div className="space-y-4">
                  <FichaDelModulo m={modulo} suites={suites} />
                  <Composicion
                    titulo={`Herramientas de ${modulo.name}`}
                    vacio={
                      moduleTools.length === 0
                        ? 'Creá una herramienta abajo para poder ponerla en este módulo.'
                        : 'Ninguna herramienta es compatible con este módulo. Una herramienta declara con qué módulos sirve; las abiertas sólo entran si el módulo acepta abiertas.'
                    }
                    // Sólo las compatibles: ofrecer una que el backend va a
                    // rechazar hace perder el tiempo y enseña mal el modelo.
                    opciones={moduleTools.filter((u) => esCompatible(u, modulo))}
                    seleccionados={modulo.module_tools.map((u) => u.id)}
                    onGuardar={(ids) => conManejoDeError(() => asignarHerramientasAlModulo(modulo.id, ids))}
                    etiqueta={(u) => {
                      const util = moduleTools.find((x) => x.id === u.id);
                      return (
                        <span className="flex items-center gap-2">
                          {u.name}
                          {util?.tool_name ? (
                            <span className="text-xs text-muted-foreground">{util.tool_name}</span>
                          ) : (
                            <StatusBadge label="sin tool" tone="warning" />
                          )}
                        </span>
                      );
                    }}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Elegí un módulo para configurarlo.</p>
              )}
            </div>
          </section>

          <section className={PANEL_CLASS}>
            <h2 className="text-sm font-semibold text-foreground">Herramientas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Una herramienta es la presentación de una tool que ya existe. Puede declararse antes que su tool: mientras
              tanto se muestra, pero no ejecuta nada.
            </p>
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {moduleTools.length === 0 && (
                <p className="px-1 py-2 text-xs text-muted-foreground">Todavía no hay herramientas.</p>
              )}
              {moduleTools.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 rounded px-2 py-1 text-sm text-secondary-foreground hover:bg-accent"
                >
                  <span className="flex-1 truncate">
                    {u.name}
                    {u.origin === 'code' && <span className="ml-2 text-xs text-emerald-400">código</span>}
                    {u.status === 'missing' && (
                      <span className="ml-2 text-xs text-amber-400">ya no existe en el código</span>
                    )}
                    {/* La compatibilidad es lo que decide en qué módulos se puede
                        colgar, así que se ve en la lista y no sólo al componer. */}
                    <span className="ml-2 text-xs text-muted-foreground">
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
                      if (!window.confirm(`¿Eliminar la herramienta '${u.name}'?`)) return;
                      void conManejoDeError(() => deleteModuleTool(u.id));
                    }}
                    className="rounded px-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
            <AltaRapida
              titulo="Nombre de la herramienta"
              conTool
              tools={tools}
              onCrear={async (input) => {
                await conManejoDeError(() => createModuleTool(input));
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}
