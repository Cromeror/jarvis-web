import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon.js';
import {
  descargarSoporte,
  fetchSoporteBlob,
  sePuedeVer,
} from '../../lib/causacion-soportes-api.js';
import { getDocumento } from '../../lib/causacion-documentos-api.js';
import type {
  ArchivoDeDocumento as ArchivoVisible,
  DocumentoContable,
  RelacionDeDocumento,
} from '../../lib/causacion-documentos-api.js';

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
/**
 * CÓMO SE LEE UN VÍNCULO. El tipo describe la relación, NO quién manda: las dos
 * puntas son documentos independientes (el dominio no da jerarquía, y hay pares
 * donde ninguno es `PRINCIPAL`). Por eso las etiquetas son sustantivos y no
 * frases con dirección — «pago de» obligaría a saber de qué lado está parado uno.
 */
const RELACION: Record<RelacionDeDocumento['tipo_relacion'], string> = {
  remision_factura: 'Remisión',
  pago_factura: 'Pago',
  otro: 'Vínculo',
};

/** El otro extremo de la relación, mirando desde `documentoId`. */
function elOtroExtremo(r: RelacionDeDocumento, documentoId: string): string {
  return r.documento_id === documentoId ? r.documento_relacionado_id : r.documento_id;
}

/**
 * Cómo se nombra un documento en la lista de vínculos.
 *
 * Lo que el contador reconoce es el asiento —tipo, número, tercero—, no un uuid.
 * Si la IA todavía no lo leyó, cae al nombre del archivo, que es lo único cierto
 * que hay; y si tampoco hay archivo, al id, que al menos se puede buscar.
 */
function nombrarDocumento(d: DocumentoContable): string {
  const e = d.extraccion;
  const partes = [e?.tipo_documento, e?.numero_documento, e?.tercero_nombre].filter(Boolean);
  if (partes.length > 0) return partes.join(' · ');
  return d.archivos[0]?.filename ?? d.id;
}

/**
 * LOS DOCUMENTOS DEL OTRO LADO DE CADA VÍNCULO.
 *
 * Se piden al servidor uno por uno en vez de buscarlos entre las filas que la
 * tabla tiene cargadas, y no es por comodidad: **un vínculo cruza períodos y
 * páginas** —una factura de marzo pagada en abril— así que resolverlos contra lo
 * visible los mostraría a veces sí y a veces no, según dónde estuviera parado el
 * usuario. Un vínculo que aparece y desaparece es peor que no tenerlo.
 *
 * Son pocos por documento (uno, dos), así que no hay endpoint de lote: el día
 * que los haya se agrega, y este hook es el único lugar que cambia.
 */
function useRelacionados(
  projectId: string,
  documento: DocumentoContable | null,
): { cargando: boolean; items: { relacion: RelacionDeDocumento; doc: DocumentoContable | null }[] } {
  const [items, setItems] = useState<{ relacion: RelacionDeDocumento; doc: DocumentoContable | null }[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!documento || documento.relaciones.length === 0) {
      setItems([]);
      return undefined;
    }
    let vivo = true;
    setCargando(true);
    const id = documento.id;
    void Promise.all(
      documento.relaciones.map((relacion) =>
        /* UN VÍNCULO QUE NO SE PUDO RESOLVER SE MUESTRA IGUAL, con `doc: null`:
           que el otro documento no se haya podido traer no borra el hecho de
           que el vínculo existe. Esconderlo sería mentir por una falla de red. */
        getDocumento(projectId, elOtroExtremo(relacion, id))
          .then((doc) => ({ relacion, doc }))
          .catch(() => ({ relacion, doc: null })),
      ),
    ).then((resueltos) => {
      if (!vivo) return;
      setItems(resueltos);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [projectId, documento]);

  return { cargando, items };
}

export function Visor({
  projectId,
  documento,
  onCerrar,
}: {
  projectId: string;
  /** El DOCUMENTO, no el archivo: es lo que tiene relaciones. `null` = cerrado. */
  documento: DocumentoContable | null;
  onCerrar: () => void;
}): React.ReactElement | null {
  const ref = useRef<HTMLDialogElement>(null);
  /* La página que se está mirando. El documento puede tener varias —una factura
     fotografiada en tres tomas— y el visor abría siempre la primera sin decir
     que había más. */
  const soporte: ArchivoVisible | null = documento?.archivos[0] ?? null;
  const { cargando: cargandoVinculos, items: vinculos } = useRelacionados(projectId, documento);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  /* `showModal()` y no el atributo `open`: sólo el método pone el backdrop y
     atrapa el foco. El atributo deja un diálogo que se ve modal y no lo es. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (documento && !d.open) d.showModal();
    if (!documento && d.open) d.close();
  }, [documento]);

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

  if (!documento) return null;

  return (
    /* `onClose` cubre las salidas que no pasan por nuestro botón —Escape y el
       backdrop—: sin esto el diálogo se cierra y el estado de arriba sigue
       creyendo que está abierto, así que no vuelve a abrirse. */
    <dialog ref={ref} className="dialog sw-soportes__visor" onClose={onCerrar}>
      <article>
        <header>
          <h2>{soporte?.filename ?? 'Documento sin archivo'}</h2>
          <p>
            {soporte ? `${soporte.kind ?? ''} · ${formatearTamano(soporte.size_bytes ?? 0)}` : 'Sin archivo adjunto'}
            {documento.archivos.length > 1 ? ` · página 1 de ${documento.archivos.length}` : ''}
          </p>
        </header>

        <section className="sw-soportes__visorCuerpo">
          {!soporte ? (
            <p className="sw-soportes__visorNada">Este documento no tiene ningún archivo.</p>
          ) : !sePuedeVer(soporte.kind ?? '') ? (
            /* SE DICE QUÉ ES Y QUÉ SE PUEDE HACER, no «no se puede». Un PDF o
               una planilla son soportes válidos; lo que falta es el visor, no
               el archivo. */
            <p className="sw-soportes__visorNada">
              Un {soporte.kind ?? ''} no se puede ver acá todavía. Descargalo para abrirlo.
            </p>
          ) : error ? (
            <p className="sw-soportes__visorNada">{error}</p>
          ) : cargando ? (
            <p className="sw-soportes__visorNada">Cargando…</p>
          ) : url ? (
            /* El `alt` es el nombre del archivo: es lo único cierto que sabemos
               de la imagen. Describir el contenido sería inventarlo. */
            <img className="sw-soportes__visorImg" src={url} alt={soporte.filename ?? 'documento'} />
          ) : null}
        </section>

        {/* LOS DOCUMENTOS RELACIONADOS, debajo de la evidencia y no en otra
            pantalla. La causación es un proceso de AGRUPACIÓN —todo nace suelto
            y los vínculos van apareciendo— así que «con qué más va esto» es
            parte de mirar el documento, no una consulta aparte.

            La sección no se dibuja cuando no hay vínculos: un encabezado que
            dice «Relacionados» sobre una lista vacía ocupa alto para informar
            que no hay nada, y eso ya lo dice la celda de la tabla al no mostrar
            contador. */}
        {documento.relaciones.length > 0 ? (
          <section className="sw-soportes__vinculosLista">
            <h3>
              {documento.relaciones.length === 1
                ? 'Un documento relacionado'
                : `${documento.relaciones.length} documentos relacionados`}
            </h3>
            {cargandoVinculos ? (
              <p className="sw-soportes__visorNada">Cargando…</p>
            ) : (
              <ul>
                {vinculos.map(({ relacion, doc }) => (
                  <li key={relacion.id}>
                    {/* EL TIPO DE VÍNCULO PRIMERO: es lo que explica por qué
                        este documento está acá, y sin eso la lista es un
                        montón de nombres sueltos. */}
                    <span className="sw-soportes__vinculoTipo">{RELACION[relacion.tipo_relacion]}</span>
                    <span className="sw-soportes__vinculoNombre">
                      {doc ? nombrarDocumento(doc) : 'No se pudo cargar este documento'}
                    </span>
                    {/* POR QUÉ la IA los vinculó. Es su argumento, y es lo que
                        el contador necesita para aceptar o deshacer el vínculo
                        sin abrir los dos documentos. */}
                    {relacion.evidencia ? (
                      <span className="sw-soportes__vinculoEvidencia">{relacion.evidencia}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <footer>
          {soporte ? (
            <button
              type="button"
              className="btn"
              data-variant="outline"
              onClick={() => void descargarSoporte(projectId, soporte.soporte_id, soporte.filename ?? 'documento')}
            >
              <Icon name="bajar" />
              Descargar
            </button>
          ) : null}
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
