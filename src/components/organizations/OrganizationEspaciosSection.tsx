import React, { useEffect, useRef, useState } from 'react';
import {
  agregarCarpetaDesdeDisco,
  listarCarpetasEnDisco,
  type CarpetaEnDisco,
  type Circulo,
  type MiembroDeCirculo,
  type ProyectoDeRed,
} from '../../lib/red-de-contexto-api.js';
import { Icon } from '../Icon.js';
import { Tabla, type ColumnaDeTabla } from '../ui/Tabla.js';
import { INPUT_CLASS } from './carpetas-compartidas.js';
import { mensajeDeError } from './errores.js';

type Carpeta = Circulo & { miembros: MiembroDeCirculo[] };

const COLUMNAS: ColumnaDeTabla[] = [
  { id: 'espacio', label: 'Espacio', dato: 'name', w: 260, elastica: true },
  { id: 'propias', label: 'Carpetas propias', w: 130, al: 'der', orden: false },
  { id: 'participa', label: 'Participa en', w: 120, al: 'der', orden: false },
  { id: 'disco', label: 'En disco, sin agregar', w: 240, orden: false },
  { id: 'estado', label: 'En la red', w: 220, orden: false },
];

const CHIP_DISCO =
  'inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-secondary-foreground';

/**
 * LOS ESPACIOS EN LA RED, del lado de la organización: cuántas carpetas tiene y
 * comparte cada uno, si puede participar, y las carpetas que tiene en el disco
 * sin agregar a la red.
 *
 * Desactivar un espacio entero en la red existió y se quitó: nació de un
 * malentendido —lo que se quería desactivar eran carpetas, y eso vive en
 * «Carpetas compartidas»—.
 */
export function OrganizationEspaciosSection({
  organizationId,
  carpetas,
  proyectos,
  onCambio,
}: {
  organizationId: string;
  carpetas: Carpeta[];
  proyectos: ProyectoDeRed[];
  onCambio: () => void;
}): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [enDisco, setEnDisco] = useState<CarpetaEnDisco[] | null>(null);
  const [aAgregar, setAAgregar] = useState<CarpetaEnDisco | null>(null);

  /* El disco se lee al abrir la pestaña y después de cada cambio: una carpeta
     recién agregada deja de estar «sin agregar». `carpetas` cambia con cada
     recarga de la red, así que sirve de disparador. */
  useEffect(() => {
    let vigente = true;
    void listarCarpetasEnDisco(organizationId)
      .then((r) => {
        if (vigente) setEnDisco(r.carpetas);
      })
      .catch((err: unknown) => {
        if (vigente) {
          setEnDisco([]);
          setError(mensajeDeError(err, 'No se pudo leer el disco de los espacios'));
        }
      });
    return () => {
      vigente = false;
    };
  }, [organizationId, carpetas]);

  const sinAgregar = (p: ProyectoDeRed): CarpetaEnDisco[] => (enDisco ?? []).filter((c) => c.project_id === p.id);
  const nombreDe = (id: string): string => proyectos.find((p) => p.id === id)?.name ?? id;

  const propias = (p: ProyectoDeRed) => carpetas.filter((c) => c.owner_project_id === p.id).length;
  const participa = (p: ProyectoDeRed) =>
    carpetas.filter(
      (c) => c.owner_project_id !== p.id && c.miembros.some((m) => m.project_id === p.id && m.estado === 'aprobada'),
    ).length;

  async function accion(fn: () => Promise<unknown>, fallback: string): Promise<boolean> {
    setError(null);
    try {
      await fn();
      onCambio();
      return true;
    } catch (err) {
      setError(mensajeDeError(err, fallback));
      return false;
    }
  }

  function celda(p: ProyectoDeRed, col: ColumnaDeTabla): React.ReactNode {
    switch (col.id) {
      case 'espacio':
        return (
          <div className="py-2 leading-tight">
            <div className="truncate font-medium text-foreground">{p.name}</div>
            <code className="text-[11px] text-muted-foreground">{p.id}</code>
          </div>
        );
      case 'propias':
        return propias(p);
      case 'participa':
        return participa(p);
      case 'disco': {
        if (enDisco === null) return <span className="text-xs text-muted-foreground">Leyendo…</span>;
        const lista = sinAgregar(p);
        if (lista.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1 py-2 whitespace-normal">
            {lista.map((c) => (
              <span
                key={c.slug}
                className={CHIP_DISCO}
                title={`contexto-org/${c.slug}/ — ${c.publicados} archivo(s) en publicado/${c.nombre_valido ? '' : ' · el nombre no sirve: renombrá la carpeta en minúsculas, números y guiones'}`}
              >
                <Icon name="folder" />
                {c.slug}
                <span className="text-muted-foreground">· {c.publicados}</span>
              </span>
            ))}
          </div>
        );
      }
      case 'estado':
        if (!p.tiene_root) {
          return (
            <span
              className="inline-flex items-center gap-1 text-muted-foreground"
              title="No tiene carpeta en el servidor: no tiene dónde publicar ni recibir."
            >
              <Icon name="info" />
              Sin carpeta
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <Icon name="check" />
            Activo
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <section>
      {enDisco && enDisco.length > 0 && (
        <div className="mb-3 rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-sm text-secondary-foreground">
          {enDisco.length === 1 ? 'Hay 1 carpeta' : `Hay ${enDisco.length} carpetas`} en el disco de los espacios que la
          red no conoce (columna «En disco, sin agregar»). Para la red no existen: nada sale de ahí hasta que alguien la
          agregue desde el menú del espacio.
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <Tabla<ProyectoDeRed>
        titulo="Espacios en la red"
        columnas={COLUMNAS}
        filas={proyectos}
        clave={(p) => p.id}
        nombreFila={(p) => p.name}
        seleccion={false}
        celda={celda}
        /* El menú de un espacio es agregar lo que tiene en el disco: sin nada
           para agregar, no hay menú. */
        menuFila={(p) =>
          sinAgregar(p).length === 0
            ? null
            : {
                groups: [
                  {
                    items: sinAgregar(p).map((c) => ({
                      id: `agregar:${c.slug}`,
                      label: c.nombre_valido
                        ? `Agregar «${c.slug}» a la red…`
                        : `«${c.slug}»: renombrá la carpeta para agregarla`,
                      icon: 'plus',
                      disabled: !c.nombre_valido,
                    })),
                  },
                ],
                onSelect: (id, fila) => {
                  const slug = id.slice('agregar:'.length);
                  setAAgregar(sinAgregar(fila).find((c) => c.slug === slug) ?? null);
                },
              }
        }
        textos={{ vacio: 'La organización no tiene espacios' }}
      />

      <AgregarDesdeDisco
        carpeta={aAgregar}
        espacio={aAgregar ? nombreDe(aAgregar.project_id) : ''}
        onCerrar={() => setAAgregar(null)}
        onConfirmar={(nombre) =>
          aAgregar
            ? accion(
                () =>
                  agregarCarpetaDesdeDisco(organizationId, {
                    proyecto: aAgregar.project_id,
                    slug: aAgregar.slug,
                    nombre,
                  }),
                'No se pudo agregar la carpeta',
              )
            : Promise.resolve(false)
        }
      />
    </section>
  );
}


/** Tamaño legible: lo que viajaría si se comparte. */
function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** «core» → «Core», «guia-de-estilo» → «Guia de estilo»: un punto de partida, se edita. */
function nombreSugerido(slug: string): string {
  const t = slug.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Confirmar que una carpeta que ya estaba en el disco pasa a la red. Es la
 * decisión de una persona —por eso un diálogo y no un botón directo—: desde
 * acá su `publicado/` puede llegar a otros espacios.
 */
function AgregarDesdeDisco({
  carpeta,
  espacio,
  onCerrar,
  onConfirmar,
}: {
  carpeta: CarpetaEnDisco | null;
  espacio: string;
  onCerrar: () => void;
  onConfirmar: (nombre: string) => Promise<boolean>;
}): React.ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (carpeta) {
      setNombre(nombreSugerido(carpeta.slug));
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [carpeta]);

  async function confirmar(): Promise<void> {
    if (!nombre.trim()) return;
    setEnviando(true);
    const ok = await onConfirmar(nombre.trim());
    setEnviando(false);
    if (ok) ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <article style={{ width: '100%', maxWidth: 'min(560px, calc(100vw - 2rem))' }}>
        <header>
          <h2>Agregar «{carpeta?.slug}» a la red</h2>
          <p>
            Está en el disco de {espacio}: <code>contexto-org/{carpeta?.slug}/</code>
          </p>
        </header>
        <section className="space-y-3 text-sm">
          {carpeta && (
            <p className="text-secondary-foreground">
              {carpeta.publicados} archivo(s) en <code>publicado/</code> ({tamano(carpeta.bytes_publicados)})
              {carpeta.archivos > carpeta.publicados
                ? ` y ${carpeta.archivos - carpeta.publicados} fuera de publicado/, que no se comparten nunca.`
                : '.'}
            </p>
          )}
          <ul className="list-disc space-y-1 pl-5 text-secondary-foreground">
            <li>Queda como carpeta compartida de {espacio}, y sin compartir con nadie.</li>
            <li>A otro espacio le llega recién cuando se lo invite y, con auditoría, cuando el auditor lo apruebe.</li>
            <li>Los archivos no se mueven ni se copian: quedan donde están.</li>
          </ul>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Nombre en la red</span>
            <input className={INPUT_CLASS} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
        </section>
        <footer>
          <button type="button" className="btn" data-variant="outline" onClick={() => ref.current?.close()}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={enviando || !nombre.trim()} onClick={() => void confirmar()}>
            {enviando ? 'Agregando…' : 'Agregar a la red'}
          </button>
        </footer>
      </article>
    </dialog>
  );
}
