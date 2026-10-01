import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon.js';
import {
  descargarSoporte,
  fetchSoporteBlob,
  sePuedeVer,
} from '../../lib/causacion-soportes-api.js';
import type { ArchivoDeDocumento as ArchivoVisible } from '../../lib/causacion-documentos-api.js';

/**
 * VER EL SOPORTE SIN BAJARLO.
 *
 * Es `<dialog class="dialog">` de Basecoat con la anatomía que usa el template
 * (`shell/toolbox.js:232` — `<article>` con `<header>`, `<section>` y
 * `<footer>`), y **nativo a propósito**: el template lo anota en `wizard.js` —
 * el `<dialog>` del browser trae foco atrapado, Escape y backdrop de fábrica, y
 * todo eso escrito a mano es donde viven los bugs de accesibilidad.
 *
 * ## La imagen no puede ir por `src`
 *
 * El token viaja en `Authorization` y lo pone el interceptor de `window.fetch`;
 * el browser no lo manda al cargar un `<img src>`. Así que los bytes se piden
 * con `fetch` —que sí pasa por el interceptor— y lo que consume el `<img>` es
 * un object URL. Se revoca al cerrar y al cambiar de archivo: un blob que no se
 * revoca queda en memoria hasta que se recarga la pestaña, y acá son fotos de
 * facturas de varios MB.
 */
export function Visor({
  projectId,
  soporte,
  onCerrar,
}: {
  projectId: string;
  soporte: ArchivoVisible | null;
  onCerrar: () => void;
}): React.ReactElement | null {
  const ref = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  /* `showModal()` y no el atributo `open`: sólo el método pone el backdrop y
     atrapa el foco. El atributo deja un diálogo que se ve modal y no lo es. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (soporte && !d.open) d.showModal();
    if (!soporte && d.open) d.close();
  }, [soporte]);

  useEffect(() => {
    if (!soporte || !sePuedeVer((soporte.kind ?? ''))) {
      setUrl(null);
      return undefined;
    }
    let vivo = true;
    let creada: string | null = null;
    setCargando(true);
    setError(null);
    fetchSoporteBlob(projectId, soporte.soporte_id)
      .then((blob) => {
        if (!vivo) return;
        creada = URL.createObjectURL(blob);
        setUrl(creada);
      })
      .catch((err: unknown) => {
        if (vivo) setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
      setUrl(null);
    };
  }, [projectId, soporte]);

  if (!soporte) return null;

  return (
    /* `onClose` cubre las salidas que no pasan por nuestro botón —Escape y el
       backdrop—: sin esto el diálogo se cierra y el estado de arriba sigue
       creyendo que está abierto, así que no vuelve a abrirse. */
    <dialog ref={ref} className="dialog sw-soportes__visor" onClose={onCerrar}>
      <article>
        <header>
          <h2>{(soporte.filename ?? 'documento')}</h2>
          <p>
            {(soporte.kind ?? '')} · {formatearTamano(soporte.size_bytes ?? 0)}
          </p>
        </header>

        <section className="sw-soportes__visorCuerpo">
          {!sePuedeVer((soporte.kind ?? '')) ? (
            /* SE DICE QUÉ ES Y QUÉ SE PUEDE HACER, no «no se puede». Un PDF o
               una planilla son soportes válidos; lo que falta es el visor, no
               el archivo. */
            <p className="sw-soportes__visorNada">
              Un {(soporte.kind ?? '')} no se puede ver acá todavía. Descargalo para abrirlo.
            </p>
          ) : error ? (
            <p className="sw-soportes__visorNada">{error}</p>
          ) : cargando ? (
            <p className="sw-soportes__visorNada">Cargando…</p>
          ) : url ? (
            /* El `alt` es el nombre del archivo: es lo único cierto que sabemos
               de la imagen. Describir el contenido sería inventarlo. */
            <img className="sw-soportes__visorImg" src={url} alt={(soporte.filename ?? 'documento')} />
          ) : null}
        </section>

        <footer>
          <button
            type="button"
            className="btn"
            data-variant="outline"
            onClick={() => void descargarSoporte(projectId, soporte.soporte_id, (soporte.filename ?? 'documento'))}
          >
            <Icon name="bajar" />
            Descargar
          </button>
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Cerrar
          </button>
        </footer>
      </article>
    </dialog>
  );
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
