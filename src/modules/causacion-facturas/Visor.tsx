import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon.js';
import { descargarSoporte, fetchSoporteBlob, sePuedeVer } from '../../lib/causacion-soportes-api.js';
import { getDocumento } from '../../lib/causacion-documentos-api.js';
import type {
  ArchivoDeDocumento,
  DocumentoContable,
  RelacionDeDocumento,
} from '../../lib/causacion-documentos-api.js';

/**
 * VER UN DOCUMENTO Y CON QUÉ ESTÁ ATADO.
 *
 * Es `<dialog class="dialog">` de Basecoat con la anatomía del template
 * (`shell/toolbox.js:232` — `<article>` con `<header>`, `<section>` y
 * `<footer>`), y **nativo a propósito**: el `<dialog>` del browser trae foco
 * atrapado, Escape y backdrop de fábrica, y todo eso escrito a mano es donde
 * viven los bugs de accesibilidad.
 *
 * ## Las dos cosas que muestra son de NIVELES distintos
 *
 * Es la distinción que el README del módulo deja escrita en «Agrupar no es
 * relacionar», y es la que gobierna el layout de acá:
 *
 * - **Páginas** (`agrupar`): el MISMO papel fotografiado varias veces. Un
 *   documento, un asiento. Se recorren con las flechas, en el panel de la
 *   derecha, porque son vistas de lo mismo.
 * - **Documentos relacionados** (`relacionar`): OTROS documentos, cada uno con
 *   su clasificación, su CUFE y su estado. Se eligen en la lista de la
 *   izquierda, porque cambiar de documento es cambiar de sujeto.
 *
 * De ahí sale que la lista SÓLO aparezca cuando hay relacionados: sin ellos no
 * hay nada que elegir, y una columna vacía al lado de la foto le roba ancho a lo
 * único que importa. Las flechas, igual: sólo con más de una página.
 *
 * ## El ancho hay que declararlo DOS VECES
 *
 * Basecoat le pone al diálogo `max-width: var(--container-md)` (448px), y **un
 * `max-width` le gana siempre a un `width`**, sin importar especificidad ni
 * orden. El template lo tiene medido y anotado en `wizard.css`: su asistente
 * estuvo declarado en 640 y medía 448 sin que nada fallara ni avisara. Por eso
 * acá van los dos, con el mismo valor.
 *
 * ## La imagen no puede ir por `src`
 *
 * El token viaja en `Authorization` y lo pone el interceptor de `window.fetch`;
 * el browser no lo manda al cargar un `<img src>`. Así que los bytes se piden
 * con `fetch` —que sí pasa por el interceptor— y lo que consume el `<img>` es un
 * object URL. Se revoca al cerrar y al cambiar de archivo: un blob que no se
 * revoca queda en memoria hasta que se recarga la pestaña, y acá son fotos de
 * facturas de varios MB.
 */

/**
 * CÓMO SE LEE UN VÍNCULO. El tipo describe la relación, NO quién manda: las dos
 * puntas son documentos independientes (el dominio no da jerarquía, y hay pares
 * donde ninguno es `PRINCIPAL`). Por eso son sustantivos y no frases con
 * dirección — «pago de» obligaría a saber de qué lado está parado uno.
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
 * Cómo se nombra un documento en la lista.
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

/** Una entrada de la lista de la izquierda: el documento y por qué está ahí. */
interface EnLaLista {
  doc: DocumentoContable;
  /** `null` en el documento que se abrió: es el sujeto, no un vínculo suyo. */
  relacion: RelacionDeDocumento | null;
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
function useGrupo(
  projectId: string,
  documento: DocumentoContable | null,
): { cargando: boolean; lista: EnLaLista[] } {
  const [lista, setLista] = useState<EnLaLista[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!documento) {
      setLista([]);
      return undefined;
    }
    // El documento abierto encabeza su grupo: es desde donde se está mirando.
    const propio: EnLaLista = { doc: documento, relacion: null };
    if (documento.relaciones.length === 0) {
      setLista([propio]);
      return undefined;
    }
    let vivo = true;
    setLista([propio]);
    setCargando(true);
    const id = documento.id;
    void Promise.all(
      documento.relaciones.map((relacion) =>
        getDocumento(projectId, elOtroExtremo(relacion, id))
          .then((doc): EnLaLista | null => ({ doc, relacion }))
          /* UN VÍNCULO QUE NO SE PUDO TRAER NO BORRA LA LISTA: se cae esa
             entrada y las demás se muestran. Fallar entero por una de dos
             esconde información que sí llegó. */
          .catch(() => null),
      ),
    ).then((otros) => {
      if (!vivo) return;
      setLista([propio, ...otros.filter((x): x is EnLaLista => x !== null)]);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [projectId, documento]);

  return { cargando, lista };
}

export function Visor({
  projectId,
  documento,
  onCerrar,
}: {
  projectId: string;
  /** El DOCUMENTO, no el archivo: es lo que tiene páginas y vínculos. `null` = cerrado. */
  documento: DocumentoContable | null;
  onCerrar: () => void;
}): React.ReactElement | null {
  const ref = useRef<HTMLDialogElement>(null);
  const { cargando: cargandoGrupo, lista } = useGrupo(projectId, documento);

  /** Cuál del grupo se está mirando. Arranca en el que se abrió. */
  const [verId, setVerId] = useState<string | null>(null);
  /** Qué página de ESE documento. Vuelve a la primera al cambiar de documento. */
  const [pagina, setPagina] = useState(0);

  const activo: DocumentoContable | null =
    lista.find((x) => x.doc.id === verId)?.doc ?? documento ?? null;
  const archivos: ArchivoDeDocumento[] = activo?.archivos ?? [];
  const soporte: ArchivoDeDocumento | null = archivos[Math.min(pagina, archivos.length - 1)] ?? null;

  /* LA LISTA SÓLO SI HAY CON QUÉ. Un panel izquierdo con una sola entrada —el
     documento que ya se está mirando— es una columna que no deja elegir nada y
     le quita ancho a la foto, que es a lo que se vino. */
  const hayGrupo = (documento?.relaciones.length ?? 0) > 0;

  /* LA FOTO ANTERIOR SE QUEDA HASTA QUE LA NUEVA ESTÁ LISTA.
     Antes el efecto hacía `setUrl(null)` al limpiar, así que pasar de página
     era: foto → vacío → foto. Ese vacío es el salto —el cuerpo se queda sin
     contenido y lo de abajo sube— y encima parpadea. Ahora la que se ve sólo
     se reemplaza cuando hay con qué, y mientras tanto se atenúa: el cambio se
     lee como una transición y no como un corte.

     El object URL se revoca al REEMPLAZARLO y al desmontar, no en el cleanup
     del efecto: revocarlo antes de tener la próxima es justamente lo que
     dejaba el hueco. Sin esto cada foto queda en memoria hasta recargar la
     pestaña, y son varios MB cada una. */
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const ponerUrl = (nueva: string | null): void => {
    if (urlRef.current && urlRef.current !== nueva) URL.revokeObjectURL(urlRef.current);
    urlRef.current = nueva;
    setUrl(nueva);
  };

  // El último blob, al desmontar. Va en su propio efecto sin dependencias para
  // que corra UNA vez al final y no en cada cambio de página.
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  /* `showModal()` y no el atributo `open`: sólo el método pone el backdrop y
     atrapa el foco. El atributo deja un diálogo que se ve modal y no lo es. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (documento && !d.open) d.showModal();
    if (!documento && d.open) d.close();
  }, [documento]);

  // Abrir otro documento reinicia el visor: empieza por su primera página.
  useEffect(() => {
    setVerId(documento?.id ?? null);
    setPagina(0);
  }, [documento]);

  useEffect(() => {
    if (!soporte || !sePuedeVer(soporte.kind ?? '')) {
      ponerUrl(null);
      return undefined;
    }
    let vivo = true;
    setCargando(true);
    setError(null);
    fetchSoporteBlob(projectId, soporte.soporte_id)
      .then((blob) => {
        if (!vivo) return;
        ponerUrl(URL.createObjectURL(blob));
      })
      .catch((err: unknown) => {
        if (!vivo) return;
        setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo');
        // Con error SÍ se limpia: dejar la foto anterior debajo de un mensaje
        // que habla de otra haría creer que lo que se ve es lo que falló.
        ponerUrl(null);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
    // `ponerUrl` se redefine en cada render y no es una dependencia real: lo que
    // dispara una carga nueva es el archivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, soporte]);

  if (!documento) return null;

  return (
    /* `onClose` cubre las salidas que no pasan por nuestro botón —Escape y el
       backdrop—: sin esto el diálogo se cierra y el estado de arriba sigue
       creyendo que está abierto, así que no vuelve a abrirse. */
    <dialog
      ref={ref}
      className="dialog sw-soportes__visor"
      data-ancho={hayGrupo ? 'grupo' : 'solo'}
      onClose={onCerrar}
      /* CLIC AFUERA CIERRA. El `<dialog>` nativo no lo trae —sólo Escape— y el
         backdrop es parte del PROPIO dialog, no un nodo aparte: por eso el
         clic se escucha acá y se compara el target contra el elemento. Un clic
         adentro cae en el `<article>` o en sus hijos, así que nunca iguala. */
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <article>
        <header>
          <h2>{soporte?.filename ?? 'Documento sin archivo'}</h2>
          <p>
            {soporte
              ? `${soporte.kind ?? ''} · ${formatearTamano(soporte.size_bytes ?? 0)}`
              : 'Sin archivo adjunto'}
          </p>
        </header>

        {/* EL CUERPO SE PARTE EN DOS **SÓLO SI HAY GRUPO**, con `.sw-partido`
            del template (`shell/split.css`) — el mismo componente con el que la
            pantalla de causar separa los ítems del asiento. Sin grupo el cuerpo
            es uno solo y la foto se lleva todo el ancho. */}
        <section className={hayGrupo ? 'sw-partido sw-soportes__visorPartido' : undefined}>
          {hayGrupo ? (
            <div className="sw-partido__panel sw-soportes__grupo" data-lado="izq">
              <h3>
                {lista.length === 1 && cargandoGrupo
                  ? 'Cargando los relacionados…'
                  : `${lista.length} documentos en el grupo`}
              </h3>
              {/* LA LISTA ES DE BOTONES Y NO DE TEXTO: elegir uno cambia lo que
                  muestra la derecha, así que cada entrada es una acción. */}
              <ul>
                {lista.map(({ doc, relacion }) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className="sw-soportes__grupoItem"
                      aria-current={doc.id === activo?.id ? 'true' : undefined}
                      onClick={() => {
                        setVerId(doc.id);
                        setPagina(0);
                      }}
                    >
                      {/* QUÉ ES RESPECTO DEL QUE SE ABRIÓ. El primero no es un
                          vínculo: es el documento desde el que se está mirando,
                          y decirlo evita leer la lista como «cuatro cosas
                          sueltas». */}
                      <span className="sw-soportes__grupoTipo">
                        {relacion ? RELACION[relacion.tipo_relacion] : 'Este'}
                      </span>
                      <span className="sw-soportes__grupoNombre">{nombrarDocumento(doc)}</span>
                      {doc.archivos.length > 1 ? (
                        <span className="sw-soportes__grupoPags">{doc.archivos.length} págs.</span>
                      ) : null}
                      {/* El argumento de la IA para haberlos atado: es lo que el
                          contador lee para aceptar o deshacer el vínculo sin
                          abrir los dos documentos. */}
                      {relacion?.evidencia ? (
                        <span className="sw-soportes__grupoEvidencia">{relacion.evidencia}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            className={hayGrupo ? 'sw-partido__panel sw-soportes__vista' : 'sw-soportes__vista'}
            data-lado={hayGrupo ? 'der' : undefined}
          >
            <div className="sw-soportes__visorCuerpo">
              {!soporte ? (
                <p className="sw-soportes__visorNada">Este documento no tiene ningún archivo.</p>
              ) : !sePuedeVer(soporte.kind ?? '') ? (
                /* SE DICE QUÉ ES Y QUÉ SE PUEDE HACER, no «no se puede». Un PDF
                   o una planilla son soportes válidos; lo que falta es el visor,
                   no el archivo. */
                <p className="sw-soportes__visorNada">
                  Un {soporte.kind ?? ''} no se puede ver acá todavía. Descargalo para abrirlo.
                </p>
              ) : error ? (
                <p className="sw-soportes__visorNada">{error}</p>
              ) : url ? (
                /* El `alt` es el nombre del archivo: es lo único cierto que
                   sabemos de la imagen. Describir el contenido sería inventarlo.

                   `data-cargando` la atenúa mientras viene la próxima: la que
                   se ve sigue siendo la anterior, y decirlo con opacidad es lo
                   que convierte el cambio en una transición. */
                <img
                  className="sw-soportes__visorImg"
                  src={url}
                  alt={soporte.filename ?? 'documento'}
                  data-cargando={cargando ? 'true' : undefined}
                />
              ) : null}

              {/* EL AVISO VA SUPERPUESTO Y NO EN LUGAR DE LA FOTO. Puesto en su
                  lugar, el cuerpo se vacía y todo lo de abajo sube: ése era el
                  salto. Encima, flota sobre la foto anterior, que es la pista
                  de dónde está uno mientras llega la próxima. */}
              {cargando ? (
                <span className="sw-soportes__visorCarga" role="status">
                  <Icon name="cargando" />
                </span>
              ) : null}
            </div>

            {/* PASAR PÁGINAS, con el mismo control que el navegador de período
                (`.sw-soportes__pb/__pm`, port de `sw-ctb__pb` del template): son
                la misma acción —moverse por una secuencia— y no puede haber dos
                dibujos para eso. Sólo aparece con más de una página: con una,
                dos flechas apagadas dicen que falta algo que no falta. */}
            {archivos.length > 1 ? (
              <div className="sw-soportes__paginas" role="group" aria-label="Páginas">
                <button
                  type="button"
                  className="sw-soportes__pb"
                  aria-label="Página anterior"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                >
                  <Icon name="left" />
                </button>
                <span className="sw-soportes__pm">
                  {pagina + 1} de {archivos.length}
                </span>
                <button
                  type="button"
                  className="sw-soportes__pb"
                  aria-label="Página siguiente"
                  disabled={pagina >= archivos.length - 1}
                  onClick={() => setPagina((p) => Math.min(archivos.length - 1, p + 1))}
                >
                  <Icon name="right" />
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <footer>
          {soporte ? (
            <button
              type="button"
              className="btn"
              data-variant="outline"
              onClick={() =>
                void descargarSoporte(projectId, soporte.soporte_id, soporte.filename ?? 'documento')
              }
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
