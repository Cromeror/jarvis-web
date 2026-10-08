import React, { useCallback, useEffect, useState } from 'react';
import {
  borrarCirculo,
  conectarProyecto,
  crearCirculo,
  desconectarProyecto,
  editarCirculo,
  getRedDeOrganizacion,
  sincronizarAhora,
  type Circulo,
  type MiembroDeCirculo,
  type ProyectoDeRed,
  type RedDeOrganizacion,
} from '../../lib/red-de-contexto-api.js';
import { estadoDeMiembro, slugDeNombre, slugValido } from '../../modules/red-de-contexto/estado.js';
import { StatusBadge } from '../ui/atoms/StatusBadge.js';
import { mensajeDeError } from './errores.js';

/** Mismas superficies que `OrganizationPortsSection`: viven en el mismo panel y tienen que leerse igual. */
const PANEL_CLASS = 'rounded-xl border border-white/10 bg-white/[0.03] p-4';
const INPUT_CLASS =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400 [&>option]:bg-[#221f1d] [&>option]:text-white';
const BOTON_PRIMARIO =
  'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';
const BOTON_SECUNDARIO =
  'rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40';
const BOTON_PELIGRO = 'rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40';

/**
 * LA RED DE CONTEXTO DE LA ORGANIZACIÓN: qué proyectos comparten documentación
 * con cuáles (módulo `red-de-contexto-004`).
 *
 * Vive en el panel de la organización, al lado del reparto de puertos y por la
 * misma razón: lo gobierna un permiso de ORGANIZACIÓN
 * (`red-de-contexto-004:manage`). Conectar dos proyectos es decidir qué
 * documentación sale de uno hacia otro, y esa decisión no puede tomarla un
 * proyecto sobre sí mismo.
 *
 * Lo que se arma acá es un CÍRCULO: un grupo de proyectos y un contexto
 * general para todos. Lo que cada miembro deja en
 * `contexto-org/<círculo>/publicado/` les llega a los demás; el sync corre solo
 * cada 30 segundos, y «Sincronizar ahora» no espera.
 *
 * Un proyecto sin el módulo o sin carpeta se puede conectar igual —puede estar
 * por recibirlo—, pero la pantalla lo dice: conectado y sin participar no es
 * lo mismo que funcionando.
 */
export function OrganizationRedContextoSection({ organizationId }: { organizationId: string }): React.ReactElement {
  const [datos, setDatos] = useState<RedDeOrganizacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setDatos(await getRedDeOrganizacion(organizationId));
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar la red de contexto'));
    } finally {
      setCargando(false);
    }
  }, [organizationId]);

  // Montado con `key={organizationId}`: cambiar de organización lo remonta limpio.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Corre una acción, muestra su error tal cual y recarga. Todas las de esta sección son así. */
  async function accion(fn: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setError(null);
    setAviso(null);
    try {
      await fn();
      await refresh();
      return true;
    } catch (err) {
      setError(mensajeDeError(err, fallback));
      return false;
    }
  }

  async function sincronizar(): Promise<void> {
    setSincronizando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await sincronizarAhora(organizationId);
      setAviso(
        r.errores.length
          ? `Sincronizado con ${r.errores.length} aviso(s): ${r.errores.slice(0, 3).join(' · ')}`
          : `Sincronizado: ${r.escritos} archivo(s) entregados, ${r.borrados} retirados.`,
      );
      await refresh();
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo sincronizar'));
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Red de contexto</h2>
        {datos && datos.circulos.length > 0 && (
          <button type="button" className={BOTON_SECUNDARIO} disabled={sincronizando} onClick={() => void sincronizar()}>
            {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Un círculo es un grupo de proyectos que comparten documentación. Lo que cada uno deja en{' '}
        <code className="text-slate-300">contexto-org/&lt;círculo&gt;/publicado/</code> les llega a los demás, y su IA lo
        encuentra sin que nadie se lo pase.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      {aviso && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">{aviso}</div>
      )}

      {cargando ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : datos ? (
        <div className="space-y-4">
          {datos.circulos.map((c) => (
            <TarjetaDeCirculo
              key={c.id}
              circulo={c}
              miembros={c.miembros}
              proyectos={datos.proyectos}
              onGuardar={(patch) => accion(() => editarCirculo(organizationId, c.id, patch), 'No se pudo guardar el círculo')}
              onBorrar={() => {
                if (
                  !window.confirm(
                    `¿Borrar el círculo «${c.nombre}»? Lo que sus miembros recibieron se retira de sus proyectos en la próxima sincronización. Lo que cada uno publicó se queda en su proyecto.`,
                  )
                )
                  return;
                void accion(() => borrarCirculo(organizationId, c.id), 'No se pudo borrar el círculo');
              }}
              onConectar={(projectId) => accion(() => conectarProyecto(organizationId, c.id, projectId), 'No se pudo conectar el proyecto')}
              onDesconectar={(p) => {
                if (!window.confirm(`¿Sacar a «${p.name}» de «${c.nombre}»? Deja de publicar y de recibir, y se le retira lo recibido.`)) return;
                void accion(() => desconectarProyecto(organizationId, c.id, p.id), 'No se pudo sacar el proyecto');
              }}
            />
          ))}

          <NuevoCirculo
            onCrear={(input) => accion(() => crearCirculo(organizationId, input), 'No se pudo crear el círculo')}
            vacio={datos.circulos.length === 0}
          />
        </div>
      ) : null}
    </section>
  );
}

function TarjetaDeCirculo({
  circulo,
  miembros,
  proyectos,
  onGuardar,
  onBorrar,
  onConectar,
  onDesconectar,
}: {
  circulo: Circulo;
  miembros: MiembroDeCirculo[];
  proyectos: ProyectoDeRed[];
  onGuardar: (patch: { nombre?: string; contexto?: string }) => Promise<boolean>;
  onBorrar: () => void;
  onConectar: (projectId: string) => Promise<boolean>;
  onDesconectar: (proyecto: ProyectoDeRed) => void;
}): React.ReactElement {
  const [nombre, setNombre] = useState(circulo.nombre);
  const [contexto, setContexto] = useState(circulo.contexto);
  const [guardando, setGuardando] = useState(false);
  const [elegido, setElegido] = useState('');

  // Si otra acción recargó el círculo (o lo editó otra persona), lo que se ve
  // tiene que ser lo guardado, no un borrador viejo.
  useEffect(() => {
    setNombre(circulo.nombre);
    setContexto(circulo.contexto);
  }, [circulo.nombre, circulo.contexto]);

  const porId = new Map(proyectos.map((p) => [p.id, p]));
  const conectados = new Set(miembros.map((m) => m.project_id));
  const candidatos = proyectos.filter((p) => !conectados.has(p.id));
  const cambio = nombre.trim() !== circulo.nombre || contexto !== circulo.contexto;

  async function guardar(): Promise<void> {
    setGuardando(true);
    await onGuardar({
      ...(nombre.trim() !== circulo.nombre ? { nombre: nombre.trim() } : {}),
      ...(contexto !== circulo.contexto ? { contexto } : {}),
    });
    setGuardando(false);
  }

  return (
    <div className={PANEL_CLASS}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={`${INPUT_CLASS} max-w-xs font-semibold`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          aria-label="Nombre del círculo"
        />
        <code className="rounded bg-white/5 px-2 py-1 text-xs text-slate-300" title="Carpeta en cada proyecto. No se cambia.">
          contexto-org/{circulo.slug}/
        </code>
        <span className="flex-1" />
        <button type="button" className={BOTON_PELIGRO} onClick={onBorrar}>
          Borrar círculo
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-400">
          Contexto general — lo leen todos los miembros, y su IA, en <code>{circulo.slug}/LEEME.md</code>
        </span>
        <textarea
          className={`${INPUT_CLASS} min-h-24 font-mono text-xs`}
          value={contexto}
          placeholder="Para qué existe este círculo y qué tiene que saber cada equipo del otro."
          onChange={(e) => setContexto(e.target.value)}
        />
      </label>
      {cambio && (
        <div className="mt-2 flex gap-2">
          <button type="button" className={BOTON_PRIMARIO} disabled={guardando || !nombre.trim()} onClick={() => void guardar()}>
            Guardar
          </button>
          <button
            type="button"
            className={BOTON_SECUNDARIO}
            onClick={() => {
              setNombre(circulo.nombre);
              setContexto(circulo.contexto);
            }}
          >
            Descartar
          </button>
        </div>
      )}

      <h3 className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Proyectos conectados</h3>
      {miembros.length === 0 ? (
        <p className="text-xs text-slate-400">Ninguno todavía. Hacen falta dos para que algo viaje.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {miembros.map((m) => {
            const p = porId.get(m.project_id) ?? { id: m.project_id, name: m.project_id, con_modulo: true, tiene_root: true };
            const e = estadoDeMiembro(m, p);
            return (
              <li key={m.project_id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-40 text-sm text-white">{p.name}</span>
                <span title={e.detalle}>
                  <StatusBadge label={e.etiqueta} tone={e.tono} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400" title={e.detalle}>
                  {e.detalle}
                </span>
                <button type="button" className={BOTON_PELIGRO} onClick={() => onDesconectar(p)}>
                  Sacar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {candidatos.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1">
            <span className="mb-1 block text-xs text-slate-400">Conectar un proyecto</span>
            <select className={INPUT_CLASS} value={elegido} onChange={(e) => setElegido(e.target.value)}>
              <option value="">Elegí uno…</option>
              {candidatos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {!p.con_modulo ? ' — sin el módulo' : !p.tiene_root ? ' — sin carpeta' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={BOTON_PRIMARIO}
            disabled={!elegido}
            onClick={() => {
              void onConectar(elegido).then((ok) => {
                if (ok) setElegido('');
              });
            }}
          >
            Conectar
          </button>
        </div>
      )}
    </div>
  );
}

function NuevoCirculo({
  onCrear,
  vacio,
}: {
  onCrear: (input: { slug: string; nombre: string; contexto?: string }) => Promise<boolean>;
  vacio: boolean;
}): React.ReactElement {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  /** Mientras nadie toque el slug, sigue al nombre. Una vez editado a mano, es de quien lo editó. */
  const [slugTocado, setSlugTocado] = useState(false);
  const [contexto, setContexto] = useState('');
  const [creando, setCreando] = useState(false);

  const slugFinal = slugTocado ? slug : slugDeNombre(nombre);
  const valido = nombre.trim().length > 0 && slugValido(slugFinal);

  async function crear(): Promise<void> {
    setCreando(true);
    const ok = await onCrear({ nombre: nombre.trim(), slug: slugFinal, ...(contexto.trim() ? { contexto } : {}) });
    setCreando(false);
    if (ok) {
      setNombre('');
      setSlug('');
      setSlugTocado(false);
      setContexto('');
    }
  }

  return (
    <div className={PANEL_CLASS}>
      <h3 className="mb-1 text-sm font-semibold text-white">{vacio ? 'Crear el primer círculo' : 'Nuevo círculo'}</h3>
      {vacio && (
        <p className="mb-3 text-xs text-slate-400">
          Por ejemplo «Producto», con diseño y desarrollo adentro: lo que diseño publica le llega a desarrollo, y al revés.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs text-slate-400">Nombre</span>
          <input className={INPUT_CLASS} value={nombre} placeholder="Producto" onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="w-56">
          <span className="mb-1 block text-xs text-slate-400">Carpeta (no se cambia después)</span>
          <input
            className={`${INPUT_CLASS} font-mono`}
            value={slugFinal}
            placeholder="producto"
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value);
            }}
          />
        </label>
      </div>
      {slugFinal && !slugValido(slugFinal) && (
        <p className="mt-1 text-xs text-amber-300">La carpeta va en minúsculas, números y guiones, y empieza con letra o número.</p>
      )}
      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-slate-400">Contexto general (opcional, se puede escribir después)</span>
        <textarea
          className={`${INPUT_CLASS} min-h-20 font-mono text-xs`}
          value={contexto}
          placeholder="Para qué existe este círculo y qué tiene que saber cada equipo del otro."
          onChange={(e) => setContexto(e.target.value)}
        />
      </label>
      <div className="mt-3">
        <button type="button" className={BOTON_PRIMARIO} disabled={!valido || creando} onClick={() => void crear()}>
          Crear círculo
        </button>
      </div>
    </div>
  );
}
