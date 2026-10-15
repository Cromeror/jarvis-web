import React, { useEffect, useState } from 'react';
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
import { Button } from '../ui/atoms/Button.js';
import { Dialogo } from '../ui/Dialogo.js';
import { mensajeDeError } from './errores.js';

type Carpeta = Circulo & { miembros: MiembroDeCirculo[] };

const COLUMNAS: ColumnaDeTabla[] = [
  { id: 'espacio', label: 'Espacio', dato: 'name', w: 260, elastica: true },
  { id: 'propias', label: 'Carpetas propias', w: 130, al: 'der', orden: false },
  { id: 'participa', label: 'Participa en', w: 120, al: 'der', orden: false },
  { id: 'estado', label: 'En la red', w: 220, orden: false },
];

/**
 * LOS ESPACIOS EN LA RED, del lado de la organización: cuántas carpetas tiene y
 * comparte cada uno, si puede participar, y las carpetas que tiene en el disco
 * sin agregar a la red.
 *
 * Esas carpetas sueltas son la excepción, así que no ocupan una columna: van
 * como una marca al lado del nombre del espacio, y agregarlas está en el menú
 * de su fila —que sólo aparece cuando hay algo para agregar—.
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
      case 'espacio': {
        const lista = sinAgregar(p);
        return (
          <div className="py-2 leading-tight">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-foreground">{p.name}</span>
              {lista.length > 0 && (
                <span
                  className="badge shrink-0"
                  data-variant="attention"
                  /* `title` y no `data-tooltip`: la celda recorta lo que sale de
                     ella (`overflow: hidden`) y el globo de Basecoat no se vería. */
                  title={`En el disco y fuera de la red: ${lista
                    .map(
                      (c) =>
                        `${c.slug} (${c.publicados} en publicado/${c.nombre_valido ? '' : ', el nombre no sirve'})`,
                    )
                    .join(', ')}. Se agregan desde el menú de la fila.`}
                >
                  <Icon name="folder" />
                  {lista.length} sin agregar
                </span>
              )}
            </div>
            <code className="text-[11px] text-muted-foreground">{p.id}</code>
          </div>
        );
      }
      case 'propias':
        return propias(p);
      case 'participa':
        return participa(p);
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
          <span className="inline-flex items-center gap-1 text-[var(--sw-success)]">
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
          red no conoce (marcadas «sin agregar» al lado del espacio). Para la red no existen: nada sale de ahí hasta que
          alguien la agregue desde el menú del espacio.
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">
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
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (carpeta) setNombre(nombreSugerido(carpeta.slug));
  }, [carpeta]);

  async function confirmar(): Promise<void> {
    if (!nombre.trim()) return;
    setEnviando(true);
    const ok = await onConfirmar(nombre.trim());
    setEnviando(false);
    if (ok) onCerrar();
  }

  return (
    <Dialogo
      abierto={carpeta !== null}
      onCerrar={onCerrar}
      onSubmit={() => void confirmar()}
      titulo={<>Agregar «{carpeta?.slug}» a la red</>}
      descripcion={
        <>
          Está en el disco de {espacio}: <code>contexto-org/{carpeta?.slug}/</code>
        </>
      }
      pie={
        <>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando || !nombre.trim()}>
            {enviando ? 'Agregando…' : 'Agregar a la red'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
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
      </div>
    </Dialogo>
  );
}
