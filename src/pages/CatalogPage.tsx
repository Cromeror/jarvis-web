import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import {
  CatalogApiError,
  createSuite,
  deleteSuite,
  esCompatible,
  listAssignments,
  listModules,
  listSuites,
  listModuleTools,
  setModuleTools,
  setSuiteModules,
  setSuiteProjects,
  updateModule,
  updateModuleTool,
  updateSuite,
} from '../lib/catalog-api.js';
import type { CatalogModule, CatalogSuite, CatalogModuleTool } from '../lib/catalog-api.js';
import { Tabla, type ColumnaDeTabla } from '../components/ui/Tabla.js';
import { Dialogo } from '../components/ui/Dialogo.js';
import { Icon } from '../components/Icon.js';
import { StatusBadge } from '../components/ui/atoms/StatusBadge.js';
import { paraQuienDe, nombreDistinguible } from '../lib/ficha-de-modulo.js';
import { Button } from '../components/ui/atoms/Button.js';

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary';

const PASTILLA = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none';

function mensajeDeError(err: unknown, fallback: string): string {
  if (err instanceof CatalogApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

/** Igual que en el modal de usuarios: rótulo, control y una ayuda opcional. */
function campo(rotulo: React.ReactNode, control: React.ReactNode, ayuda?: React.ReactNode): React.ReactElement {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      {control}
      {ayuda ? <span className="text-xs text-muted-foreground">{ayuda}</span> : null}
    </label>
  );
}

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

/**
 * Elegir un subconjunto de una lista, con casillas. Es el control de los dos
 * modales: los módulos y los espacios de una suite, las herramientas de un
 * módulo. Lo que se elige se guarda COMPLETO, así que no hay que decir aparte
 * qué se quitó.
 */
function Casillas<T extends { id: string }>({
  opciones,
  elegidos,
  onCambiar,
  vacio,
  etiqueta,
}: {
  opciones: T[];
  elegidos: string[];
  onCambiar: (ids: string[]) => void;
  vacio: string;
  etiqueta: (item: T) => React.ReactNode;
}): React.ReactElement {
  if (opciones.length === 0) return <p className="text-xs text-muted-foreground">{vacio}</p>;
  return (
    <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
      {opciones.map((o) => (
        <label
          key={o.id}
          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-secondary-foreground hover:bg-accent"
        >
          <input
            type="checkbox"
            checked={elegidos.includes(o.id)}
            onChange={() =>
              onCambiar(elegidos.includes(o.id) ? elegidos.filter((x) => x !== o.id) : [...elegidos, o.id])
            }
          />
          <span className="flex min-w-0 flex-1 items-center gap-2">{etiqueta(o)}</span>
        </label>
      ))}
    </div>
  );
}

const mismaLista = (a: readonly string[], b: readonly string[]): boolean => a.join('|') === b.join('|');

/**
 * Alta y edición de una suite: su nombre, qué módulos trae y en qué espacios
 * está. Las tres cosas en un modal, como editar un usuario, porque las tres se
 * deciden juntas: qué se le vende a quién.
 *
 * Al guardar se manda sólo lo que cambió. Los módulos se mandan antes que los
 * espacios: si la suite queda sin lo que un módulo requiere, el backend la
 * rechaza ahí y no se llega a asignar algo inválido.
 */
function SuiteFormModal({
  suite,
  modules,
  projects,
  asignados,
  onClose,
  onSaved,
}: {
  suite: CatalogSuite | null;
  modules: CatalogModule[];
  projects: ProjectSummary[];
  asignados: string[];
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const modulosIniciales = suite?.modules.map((m) => m.id) ?? [];
  const [name, setName] = useState(suite?.name ?? '');
  const [modulos, setModulos] = useState<string[]>(modulosIniciales);
  const [espacios, setEspacios] = useState<string[]>(asignados);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sinCambios =
    !!suite && name.trim() === suite.name && mismaLista(modulos, modulosIniciales) && mismaLista(espacios, asignados);

  async function guardar(): Promise<void> {
    if (!name.trim()) {
      setError('Hace falta un nombre');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let id = suite?.id;
      if (!id) id = (await createSuite({ name: name.trim() })).id;
      else if (name.trim() !== suite!.name) await updateSuite(id, { name: name.trim() });
      if (!suite || !mismaLista(modulos, modulosIniciales)) await setSuiteModules(id, modulos);
      if (!suite ? espacios.length > 0 : !mismaLista(espacios, asignados)) await setSuiteProjects(id, espacios);
      onSaved();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar la suite'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialogo
      abierto
      onCerrar={onClose}
      titulo={suite ? 'Editar suite' : 'Nueva suite'}
      onSubmit={() => void guardar()}
      ancho={560}
      pie={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || sinCambios} title={sinCambios ? 'No hay cambios para guardar' : undefined}>
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
        {campo('Nombre', <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />)}
        {campo(
          'Módulos',
          <Casillas
            opciones={modules}
            elegidos={modulos}
            onCambiar={setModulos}
            vacio="No hay módulos: nacen en el código y aparecen acá al arrancar la API."
            etiqueta={(m) => (
              <>
                <span className="truncate">{nombreDistinguible(m, modules)}</span>
                {m.key && <code className="shrink-0 text-[11px] text-muted-foreground">{m.key}</code>}
                <EjesDelModulo m={m} />
              </>
            )}
          />,
          'Si un módulo requiere otro, los dos tienen que venir en la suite.',
        )}
        {campo(
          'Espacios',
          <Casillas
            opciones={projects}
            elegidos={espacios}
            onCambiar={setEspacios}
            vacio="No hay espacios."
            etiqueta={(p) => <span className="truncate">{p.name}</span>}
          />,
          'Los espacios que la tienen ven sus módulos en el riel. Asignarla habilita sus herramientas en el espacio.',
        )}
      </div>
    </Dialogo>
  );
}

/**
 * Edición de un módulo: lo único que la pantalla puede cambiar de él —nombre
 * visible y slug— y qué herramientas ofrece. Lo demás lo declara el código.
 *
 * Las herramientas se renombran acá, adentro del módulo que las ofrece. Una
 * herramienta abierta puede estar en varios módulos, así que su nombre cambia
 * en todos: se avisa.
 */
function ModuleFormModal({
  modulo,
  moduleTools,
  onClose,
  onSaved,
}: {
  modulo: CatalogModule;
  moduleTools: CatalogModuleTool[];
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const herramientasIniciales = modulo.module_tools.map((t) => t.id);
  const [name, setName] = useState(modulo.name);
  const [slug, setSlug] = useState(modulo.slug);
  const [herramientas, setHerramientas] = useState<string[]>(herramientasIniciales);
  const [nombres, setNombres] = useState<Record<string, string>>(
    Object.fromEntries(moduleTools.map((t) => [t.id, t.name])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sólo las compatibles: ofrecer una que el backend va a rechazar hace perder
  // el tiempo y enseña mal el modelo.
  const compatibles = moduleTools.filter((t) => esCompatible(t, modulo));
  const renombradas = compatibles.filter((t) => (nombres[t.id] ?? t.name).trim() !== t.name);
  const sinCambios =
    name.trim() === modulo.name &&
    slug.trim() === modulo.slug &&
    mismaLista(herramientas, herramientasIniciales) &&
    renombradas.length === 0;

  async function guardar(): Promise<void> {
    if (!name.trim() || !slug.trim()) {
      setError('El nombre y el slug no pueden quedar vacíos');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (name.trim() !== modulo.name || slug.trim() !== modulo.slug) {
        await updateModule(modulo.id, {
          ...(name.trim() !== modulo.name ? { name: name.trim() } : {}),
          ...(slug.trim() !== modulo.slug ? { slug: slug.trim() } : {}),
        });
      }
      for (const t of renombradas) {
        if (!(nombres[t.id] ?? '').trim()) throw new Error(`La herramienta '${t.name}' no puede quedar sin nombre`);
        await updateModuleTool(t.id, { name: nombres[t.id]!.trim() });
      }
      if (!mismaLista(herramientas, herramientasIniciales)) await setModuleTools(modulo.id, herramientas);
      onSaved();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar el módulo'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialogo
      abierto
      onCerrar={onClose}
      titulo="Editar módulo"
      descripcion={
        <>
          {modulo.key && <code className="text-[11px]">{modulo.key}</code>} · La descripción y las herramientas que
          ofrece las declara el código.
        </>
      }
      onSubmit={() => void guardar()}
      ancho={600}
      pie={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || sinCambios} title={sinCambios ? 'No hay cambios para guardar' : undefined}>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {campo('Nombre visible', <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />)}
          {campo(
            'Slug',
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className={INPUT_CLASS} />,
            'Va en la URL del riel.',
          )}
        </div>
        {campo(
          'Herramientas',
          <Casillas
            opciones={compatibles}
            elegidos={herramientas}
            onCambiar={setHerramientas}
            vacio="Ninguna herramienta es compatible con este módulo."
            etiqueta={(t) => (
              <>
                <input
                  type="text"
                  value={nombres[t.id] ?? t.name}
                  onChange={(e) => setNombres((n) => ({ ...n, [t.id]: e.target.value }))}
                  // El clic en el texto no tiene que alternar la casilla.
                  onClick={(e) => e.preventDefault()}
                  className={`${INPUT_CLASS} py-1`}
                  aria-label={`Nombre de ${t.name}`}
                />
                {t.tool_name ? (
                  <code className="shrink-0 text-[11px] text-muted-foreground">{t.tool_name}</code>
                ) : (
                  <StatusBadge label="sin tool" tone="warning" />
                )}
              </>
            )}
          />,
          'Una herramienta abierta puede estar en varios módulos: renombrarla la renombra en todos.',
        )}
      </div>
    </Dialogo>
  );
}

/** «9 módulos · 38 herramientas · 1 ya no existe en el código»: el resumen del acordeón contraído. */
function resumenDeModulos(modules: CatalogModule[], moduleTools: CatalogModuleTool[]): string {
  const partes = [
    `${modules.length} ${modules.length === 1 ? 'módulo' : 'módulos'}`,
    `${moduleTools.length} ${moduleTools.length === 1 ? 'herramienta' : 'herramientas'}`,
  ];
  const faltan = modules.filter((m) => m.status === 'missing').length;
  if (faltan) partes.push(`${faltan} ya no ${faltan === 1 ? 'existe' : 'existen'} en el código`);
  return partes.join(' · ');
}

/**
 * Configuración del catálogo — suites, y los módulos con sus herramientas.
 *
 * Exclusiva del operador, igual que el backend: acá se define el producto que
 * después se le asigna a cada cliente. Un cliente no ve esta pantalla; ve el
 * resultado, que es su menú.
 *
 * A LA VISTA QUEDAN SÓLO LAS SUITES, que es lo que se configura seguido. Los
 * módulos y sus herramientas nacen en el código y los trae el sync al arrancar
 * la API: acá no se crean ni se borran, y cambian poco, así que van en un
 * acordeón contraído —como los roles en `/usuarios`— y se editan desde el menú
 * de cada fila.
 */
export function CatalogPage(): React.ReactElement {
  const { user } = useAuth();
  const [suites, setSuites] = useState<CatalogSuite[]>([]);
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [moduleTools, setModuleToolsList] = useState<CatalogModuleTool[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [editandoSuite, setEditandoSuite] = useState<CatalogSuite | 'nueva' | null>(null);
  const [editandoModulo, setEditandoModulo] = useState<CatalogModule | null>(null);
  const [modulosAbiertos, setModulosAbiertos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const [s, m, t, proj, asg] = await Promise.all([
        listSuites(),
        listModules(),
        listModuleTools(),
        listProjects(),
        listAssignments(),
      ]);
      setSuites(s);
      setModules(m);
      setModuleToolsList(t);
      setProjects(proj);
      setAssignments(asg);
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

  const nombreDeEspacio = useMemo(() => {
    const porId = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string): string => porId.get(id) ?? id;
  }, [projects]);

  /** Qué suites traen cada módulo: la columna que responde «¿a quién le llega?». */
  const suitesPorModulo = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const s of suites) for (const m of s.modules) mapa.set(m.id, [...(mapa.get(m.id) ?? []), s.name]);
    return mapa;
  }, [suites]);

  // El operador es el único que configura el producto. Un cliente que llegue
  // por URL se va al inicio, no ve una pantalla vacía.
  if (user && user.account_type !== 'operator') return <Navigate to="/" replace />;

  /* Proporción 20 · 45 · 35: los módulos son la columna de largo impredecible
     —una suite puede traer uno o diez— y es la que absorbe el ancho. */
  const COLUMNAS_SUITE: ColumnaDeTabla[] = [
    { id: 'name', label: 'Suite', dato: 'name', w: 200, tip: true, va: 'arriba' },
    { id: 'modulos', label: 'Módulos', w: 450, orden: false, elastica: true },
    { id: 'espacios', label: 'Espacios', w: 350, orden: false },
  ];

  const menuDeSuite = (s: CatalogSuite) => ({
    groups: [
      { items: [{ id: 'editar', label: 'Editar la suite' }] },
      { items: [{ id: 'eliminar', label: 'Eliminar la suite', danger: true }] },
    ],
    onSelect: (id: string) => {
      if (id === 'editar') {
        setEditandoSuite(s);
        return;
      }
      if (!window.confirm(`¿Eliminar la suite '${s.name}'? Los módulos no se borran, y los espacios que la tenían dejan de verlos.`)) return;
      void deleteSuite(s.id)
        .then(refresh)
        .catch((err: unknown) => setError(mensajeDeError(err, 'No se pudo eliminar la suite')));
    },
  });

  function celdaDeSuite(s: CatalogSuite, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'name') return <span className="font-medium">{s.name}</span>;
    if (c.id === 'modulos') {
      if (s.modules.length === 0) return <StatusBadge label="sin módulos" tone="warning" />;
      return (
        <div className="flex flex-wrap gap-1">
          {s.modules.map((m) => (
            <StatusBadge key={m.id} label={nombreDistinguible(m, modules)} tone={paraQuienDe(m) === 'organizacion' ? 'info' : 'neutral'} />
          ))}
        </div>
      );
    }
    if (c.id === 'espacios') {
      const ids = assignments[s.id] ?? [];
      if (ids.length === 0) return <span className="text-xs opacity-70">Ninguno</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <StatusBadge key={id} label={nombreDeEspacio(id)} tone="neutral" />
          ))}
        </div>
      );
    }
    return null;
  }

  /* El nombre, el código y para quién es, angostos; las herramientas son la
     elástica, por lo mismo que los módulos de una suite. */
  const COLUMNAS_MODULO: ColumnaDeTabla[] = [
    { id: 'name', label: 'Módulo', dato: 'name', w: 200, tip: true, va: 'arriba' },
    { id: 'key', label: 'Código', dato: 'key', w: 100 },
    { id: 'ejes', label: 'Para quién · dónde', w: 170, orden: false },
    { id: 'suites', label: 'Lo traen', w: 200, orden: false },
    { id: 'herramientas', label: 'Herramientas', w: 450, orden: false, elastica: true },
  ];

  const menuDeModulo = (m: CatalogModule) => ({
    groups: [{ items: [{ id: 'editar', label: 'Editar el módulo' }] }],
    onSelect: () => setEditandoModulo(m),
  });

  function celdaDeModulo(m: CatalogModule, c: ColumnaDeTabla): React.ReactNode {
    if (c.id === 'name') {
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{nombreDistinguible(m, modules)}</span>
          {/* El código dejó de declararlo: sigue configurado en suites, pero ya
              no resuelve nada. */}
          {m.status === 'missing' && <StatusBadge label="ya no existe en el código" tone="warning" />}
        </span>
      );
    }
    if (c.id === 'key') return <code className="text-[11px] text-muted-foreground">{m.key}</code>;
    if (c.id === 'ejes') return <EjesDelModulo m={m} />;
    if (c.id === 'suites') {
      const nombres = suitesPorModulo.get(m.id) ?? [];
      return nombres.length > 0 ? (
        <span className="text-xs">{nombres.join(', ')}</span>
      ) : (
        <span className="text-xs opacity-70">Ninguna suite</span>
      );
    }
    if (c.id === 'herramientas') {
      if (m.module_tools.length === 0) return <span className="text-xs opacity-70">Ninguna</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {m.module_tools.map((t) => (
            <span key={t.id} title={t.tool_name ?? 'Sin tool: se muestra, pero no ejecuta nada'}>
              <StatusBadge label={t.name} tone={t.tool_name ? 'neutral' : 'warning'} />
            </span>
          ))}
        </div>
      );
    }
    return null;
  }

  return (
    /* Misma anatomía que `/usuarios`: sin título de página, el acordeón arriba
       y la tabla abajo, separados por una línea. */
    <div className="h-full overflow-y-auto bg-[var(--sw-ink)] p-6">

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {/* LOS MÓDULOS EN UN ACORDEÓN, ARRIBA, como los roles en `/usuarios`:
              contraído —el estado de partida— dice cuántos hay; expandido, la
              tabla. Cambian en el código, no acá, así que no ocupan la vista. */}
          <section className="accordion mb-8 overflow-hidden rounded-xl border border-[var(--sw-line-strong)] bg-card">
            <details className="group" open={modulosAbiertos} onToggle={(e) => setModulosAbiertos(e.currentTarget.open)}>
              <summary className="items-center gap-3 px-4 py-3 hover:bg-accent hover:no-underline">
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">Módulos y herramientas</span>
                  <span className="text-xs text-muted-foreground">{resumenDeModulos(modules, moduleTools)}</span>
                </span>
                <Icon name="chevron" className="text-muted-foreground" />
              </summary>
              {/* Cerrado, este div NO EXISTE (`hidden`), y el separador va sólo con
              el acordeón abierto. Basecoat no oculta el contenido de un
              <details> cerrado: lo deja en alto cero con una transición, y el
              borde de este div quedaba asomando debajo del encabezado. */}
          <div className="hidden border-[var(--sw-line-strong)] p-3 group-open:block group-open:border-t">
                <Tabla<CatalogModule>
                  titulo="Módulos"
                  columnas={COLUMNAS_MODULO}
                  filas={modules}
                  clave={(m) => m.id}
                  nombreFila={(m) => m.name}
                  seleccion={false}
                  menuFila={menuDeModulo}
                  celda={celdaDeModulo}
                  porPagina={25}
                  opcionesPagina={[25, 50]}
                  textos={{
                    vacio: 'No hay módulos',
                    vacioPaso: 'Los módulos nacen en el código y aparecen acá cuando arranca la API.',
                  }}
                />
              </div>
            </details>
          </section>

          <section className="flex flex-col gap-4 border-t border-border pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-sm font-semibold text-foreground">Suites</h2>
              <Button variant="outline" onClick={() => setEditandoSuite('nueva')}>
                Agregar suite
              </Button>
            </div>
            <Tabla<CatalogSuite>
              titulo="Suites"
              columnas={COLUMNAS_SUITE}
              filas={suites}
              clave={(s) => s.id}
              nombreFila={(s) => s.name}
              seleccion={false}
              menuFila={menuDeSuite}
              celda={celdaDeSuite}
              porPagina={25}
              opcionesPagina={[25, 50]}
              textos={{
                vacio: 'Todavía no hay suites',
                vacioPaso: 'Sin una suite asignada, un espacio no ve ningún módulo en el riel.',
              }}
            />
          </section>
        </>
      )}

      {editandoSuite && (
        <SuiteFormModal
          suite={editandoSuite === 'nueva' ? null : editandoSuite}
          modules={modules}
          projects={projects}
          asignados={editandoSuite === 'nueva' ? [] : assignments[editandoSuite.id] ?? []}
          onClose={() => setEditandoSuite(null)}
          onSaved={() => {
            setEditandoSuite(null);
            void refresh();
          }}
        />
      )}

      {editandoModulo && (
        <ModuleFormModal
          modulo={editandoModulo}
          moduleTools={moduleTools}
          onClose={() => setEditandoModulo(null)}
          onSaved={() => {
            setEditandoModulo(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
