import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ModuleViewProps } from '../registry.js';
import { Icon } from '../../components/Icon.js';
import {
  SoporteApiError,
  eliminarDocumento,
  descargarSoporte,
  fetchLimits,
  leerBase64,
  uploadDocument,
} from '../../lib/causacion-soportes-api.js';
import { COLUMNAS, COLUMNAS_POR_DEFECTO } from './columnas.js';
import { Tabla, type ColumnaDeTabla } from '../../components/ui/Tabla.js';
import { Avance } from './Avance.js';
import { Visor } from './Visor.js';
import {
  buscarDocumentos,
  type DocumentoContable,
  type ArchivoDeDocumento,
  type DocumentoDeAvance,
  type EstadoDocumento,
} from '../../lib/causacion-documentos-api.js';
import type { GrupoDeMenu } from '../../components/ui/MenuContextual.js';
import { usePublicarMedida } from '../../components/layout/medida-de-superficie.js';

/**
 * Área de trabajo de `causacion-facturas-001`: subir soportes y verlos.
 *
 * ESCRITA CON LA ANATOMÍA DEL TEMPLATE — clases semánticas `sw-*` y su hoja en
 * `theme/modulos/soportes.css`, no utilidades sueltas. La versión anterior era
 * Tailwind sobre `DataTable`, que consume tokens `--table2-*` del design system
 * viejo: en esta rama esos tokens NO EXISTEN, así que la tabla se pintaba sin
 * fondo, sin borde y sin padding. No era una diferencia de gusto.
 */

/**
 * Las columnas, en el vocabulario de la TABLA DEL TEMPLATE.
 *
 * `COLUMNAS` (en `columnas.ts`) sigue siendo la fuente: define qué hay y de
 * dónde se lee cada dato —columna indexada o clave del jsonb—. Acá sólo se
 * traduce a la forma que la tabla pide (`{ id, label, w, al, tip }`), y se
 * marca cuáles arrancan escondidas.
 *
 * `elastica` en el tercero: es la única columna de texto libre, y el template
 * es explícito en que sólo esa puede encogerse — «una cifra truncada no es una
 * cifra, y una fecha a medias tampoco».
 */
const ANCHOS: Record<string, number> = {
  archivos: 220,
  tipo_documento: 150,
  fecha: 120,
  tercero_nombre: 240,
  numero_documento: 140,
  valor_total: 130,
  estado: 120,
  clasificacion: 150,
};

function aColumnaDeTabla(c: (typeof COLUMNAS)[number]): ColumnaDeTabla {
  return {
    id: c.key,
    label: c.header,
    dato: c.key,
    w: ANCHOS[c.key] ?? 140,
    al: c.numerica ? 'der' : undefined,
    // El globo sólo donde puede haber recorte de verdad.
    tip: !c.numerica && c.key !== 'estado',
    elastica: c.key === 'tercero_nombre',
  };
}

/**
 * LAS SIETE QUE SE DIBUJAN y LAS QUE SE PUEDEN AGREGAR.
 *
 * No es «mostrar siete y esconder catorce»: son dos listas de distinta
 * naturaleza, y el template las separa en dos menús por eso. El primero
 * contesta *qué de lo que hay quiero ver* —siete tildes—; el segundo, *qué más
 * hay*. Meter las catorce abajo de las siete convertiría el menú en una lista
 * de veintiuna cosas que no se parecen.
 */
const COLUMNAS_DE_TABLA: ColumnaDeTabla[] = COLUMNAS.filter((c) =>
  COLUMNAS_POR_DEFECTO.includes(c.key),
).map(aColumnaDeTabla);

const COLUMNAS_MAS: ColumnaDeTabla[] = COLUMNAS.filter(
  (c) => !COLUMNAS_POR_DEFECTO.includes(c.key),
).map(aColumnaDeTabla);

/** El dominio pinta la celda; la tabla arma la grilla. */
function celdaDeDocumento(
  doc: DocumentoContable,
  col: ColumnaDeTabla,
  abrir: (d: DocumentoContable) => void,
): React.ReactNode {
  const def = COLUMNAS.find((c) => c.key === col.id);
  const valor = def ? def.leer(doc) : '';
  /* Un dato que el extractor no leyó deja la celda VACÍA, sin guion ni
     placeholder: es lo que hace el template (`esc(f[c.dato] == null ? '' : …)`).
     Había un `—` con clase propia, que era UI inventada — y además, con
     veinticuatro columnas, una pantalla de guiones pesa más que el hueco. */
  if (!valor) return null;
  if (col.id === 'archivos') {
    /* UN BOTÓN Y NO UN ENLACE, y el cambio no es de estilo: el `href` iba a la
       URL de descarga, que es una NAVEGACIÓN —sin el `Authorization` que pone
       el interceptor de `fetch`—, así que devolvía 401. Y además lo que hace
       ahora no es ir a ningún lado: abre el visor. */
    return (
      <button
        type="button"
        className="sw-soportes__archivo"
        onClick={() => abrir(doc)}
        title={doc.archivos.length === 1 ? 'Abrir' : `${doc.archivos.length} páginas`}
      >
        {valor}
      </button>
    );
  }
  if (col.id === 'estado') return <Estado estado={doc.estado} />;
  // Las clases tipográficas son del template: `sw-mono` para un consecutivo,
  // `sw-tabular` para que las fechas y las cifras alineen dígito con dígito.
  if (col.id === 'numero_documento' || col.id === 'cufe_cude') {
    return <span className="sw-mono">{valor}</span>;
  }
  if (col.id === 'fecha' || col.al === 'der') return <span className="sw-tabular">{valor}</span>;
  return valor;
}

/**
 * El estado del procesamiento, con el PUNTO del template (`.sw-tabla__punto`).
 *
 * Era una píldora con la palabra adentro (`.sw-soportes__estado`), inventada.
 * El template ya resuelve esto y su decisión está escrita al lado del código:
 * **el tono sale del dato, no de la columna** — un documento que todavía no se
 * procesó está esperando, y pintarlo del mismo naranja que a uno que falló
 * «inventa un problema que no hay».
 *
 * `data-lleno` (relleno vs. contorno) y `data-tono` (color) son dos ejes
 * distintos a propósito: el relleno dice si el hecho ocurrió, el tono dice si
 * eso está bien. Y lleva `role="img"` con su etiqueta, porque un punto de 9px
 * sin nombre accesible no dice nada.
 */
const DICHO: Record<EstadoDocumento, string> = {
  PENDIENTE_PROCESAR: 'Todavía sin procesar',
  PENDIENTE_AUDITAR: 'Esperando al contador',
  COMPLETADO: 'Válido ante la DIAN',
  AUDITADO: 'Causación cerrada',
};

/**
 * El eje único, con el PUNTO del template.
 *
 * Antes eran dos columnas —el estado del procesamiento del archivo y el de
 * trazabilidad—, que contestaban lo mismo con distinto vocabulario.
 *
 * `data-lleno` dice si el hecho ocurrió; `data-tono`, si eso está bien. Sólo lo
 * que espera a una persona va en naranja: un documento que la IA todavía no
 * miró está en cola, no en problema.
 */
function Estado({ estado }: { estado: EstadoDocumento }): React.ReactElement {
  const tono = estado === 'AUDITADO' || estado === 'COMPLETADO' ? 'ok' : estado === 'PENDIENTE_AUDITAR' ? 'falta' : 'espera';
  return (
    <span
      className="sw-tabla__punto"
      data-lleno={String(estado === 'AUDITADO')}
      data-tono={tono}
      role="img"
      aria-label={DICHO[estado]}
      title={DICHO[estado]}
    />
  );
}

interface Rechazo {
  filename: string;
  motivo: string;
}

export function View({ projectId }: ModuleViewProps): React.ReactElement {
  const [documentos, setDocumentos] = useState<DocumentoContable[]>([]);
  const [total, setTotal] = useState(0);

  /* EL SEGUNDO RENGLÓN DEL TÍTULO. El template lo arma con
     `[mod.sub, val].filter(Boolean)`: la descripción la declara el módulo, la
     CUENTA la publica la superficie viva. Una cuenta sin sujeto no dice nada
     —«17» no se sabe de qué— y por eso va debajo de la descripción, no sola. */
  usePublicarMedida(total ? `${total} ${total === 1 ? 'documento' : 'documentos'}` : null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazos, setRechazos] = useState<Rechazo[]>([]);
  /* CANCELAR LA SUBIDA. Elegir veinte archivos y darse cuenta de que eran los
     del mes equivocado no puede obligar a esperar a que entren los veinte. */
  const cancelarSubida = useRef(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [cancelados, setCancelados] = useState(0);
  const [extensiones, setExtensiones] = useState<string[]>([]);
  /* Los DOCUMENTOS son otra población que los soportes: un documento agrupa
     los archivos que lo componen (§2.2). Los cuenta la tarjeta de avance; la
     tabla de abajo sigue listando archivos. */
  const [avance, setAvance] = useState<DocumentoDeAvance[]>([]);
  /**
   * El ARCHIVO que se está mirando. `null` = el visor está cerrado.
   *
   * La fila es un documento y puede tener varias páginas; el visor abre la
   * primera. Elegir cuál ver con más de una es trabajo del visor, no de acá.
   */
  const [mirando, setMirando] = useState<ArchivoDeDocumento | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      /* LA TABLA LISTA DOCUMENTOS, no archivos. Es lo que se clasifica, se
         causa y se cierra; el archivo es su evidencia y puede ser más de uno. */
      const { documentos: docs, total: t } = await buscarDocumentos(projectId, { limit: 200 });
      setDocumentos(docs);
      setTotal(t);
      setError(null);
      /* El avance se recarga con la tabla y en la misma vuelta: subir un
         archivo no cambia los documentos todavía —eso lo hace la IA al
         analizarlo—, pero borrar uno sí puede, y dos recargas desfasadas dejan
         la tarjeta contando algo que la tabla ya no muestra.
         Su falla NO voltea la pantalla: la tabla es lo que hay que ver. */
      /* La tarjeta cuenta sobre los MISMOS documentos que la tabla: dos
         consultas desfasadas dejan la cuenta hablando de otra cosa. */
      setAvance(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los documentos');
    } finally {
      setCargando(false);
    }
  }, [projectId]);

  useEffect(() => {
    void recargar();
    // Los formatos aceptados los decide el SERVIDOR; se piden en vez de
    // escribirlos acá para que el `accept` del input no se desincronice de lo
    // que la validación realmente permite.
    void fetchLimits(projectId)
      .then((l) => setExtensiones(l.extensiones))
      .catch(() => setExtensiones([]));
  }, [projectId, recargar]);

  /**
   * Se sube archivo por archivo y los rechazos se ACUMULAN, no cortan.
   *
   * Es lo contrario a los adjuntos del chat (todo o nada por turno) y por una
   * razón concreta: acá cada documento es independiente, y que una factura de
   * veinte sea un formato no soportado no es motivo para descartar las otras
   * diecinueve que la persona ya seleccionó.
   */
  async function subir(files: File[]): Promise<void> {
    if (files.length === 0) return;
    cancelarSubida.current = false;
    setSubiendo(true);
    setProgreso({ hecho: 0, total: files.length });
    setCancelados(0);
    setError(null);
    const fallidos: Rechazo[] = [];
    let sinHacer = 0;

    for (const [i, file] of files.entries()) {
      /* SE CORTA ENTRE ARCHIVOS, NO EN MEDIO DE UNO. Abortar un POST a mitad de
         camino deja al servidor decidiendo qué hacer con medio archivo; entre
         uno y otro, en cambio, el estado es exacto: los de antes entraron, los
         de después no se intentaron, y eso es lo que se reporta. */
      if (cancelarSubida.current) {
        sinHacer = files.length - i;
        break;
      }
      try {
        const content_base64 = await leerBase64(file);
        await uploadDocument(projectId, { filename: file.name, content_base64 });
      } catch (err) {
        const motivo = err instanceof SoporteApiError || err instanceof Error ? err.message : 'no se pudo subir';
        fallidos.push({ filename: file.name, motivo });
      }
      setProgreso({ hecho: i + 1, total: files.length });
    }

    setRechazos(fallidos);
    setCancelados(sinHacer);
    setProgreso(null);
    setSubiendo(false);
    // Se recarga aunque haya fallidos: los que sí entraron tienen que verse.
    await recargar();
    if (inputRef.current) inputRef.current.value = '';
  }


  /**
   * EL MENÚ DE LA FILA — y con él, el de la TABLA.
   *
   * No es decoración: en el template la columna `__menu` sólo existe si hay
   * `menuFila` (`.concat(o.menuFila ? [COL_MENU] : [])` en `table.js`), y el
   * botón `…` de la CABECERA —el que abre las tildes de columnas y «Agregar una
   * columna…»— vive en esa misma columna, un nivel arriba. Sin menú de fila la
   * tabla se quedaba sin la columna, sin el `…` y sin forma de elegir qué
   * columnas ver: las catorce escondidas no tenían puerta.
   *
   * Las tres acciones son las que el módulo REALMENTE puede hacer hoy
   * (`/download`, el `cufe_cude` leído, `DELETE`). Ninguna inventada: el
   * template apaga con su nombre puesto lo que todavía no tiene de dónde salir
   * —«esconderlo haría creer que la función no existe»—, que es lo que hace acá
   * copiar el código cuando el extractor no lo leyó.
   */
  function menuDeFila(doc: DocumentoContable): {
    groups: GrupoDeMenu[];
    onSelect: (id: string, f: DocumentoContable) => void;
  } {
    const codigo = doc.trazabilidad.cufe_cude ?? '';
    /* Descargar es por ARCHIVO, y un documento puede tener varios. Se ofrece el
       primero: con más de uno, la acción correcta es abrir el visor y elegir —
       descargar «el documento» cuando son tres páginas no significa nada. */
    const primero = doc.archivos[0];
    return {
      groups: [
        {
          items: [
            /* El endpoint fuerza `Content-Disposition: attachment` (servir un
               PDF o un SVG inline es confiar en el contenido), así que no hay
               un «abrir» distinto de un «descargar»: es una sola acción. */
            {
              id: 'bajar',
              label: doc.archivos.length > 1 ? 'Descargar la primera página' : 'Descargar el original',
              icon: 'bajar',
              disabled: !primero,
            },
            {
              id: 'cufe',
              label: 'Copiar el CUFE / CUDE',
              icon: 'copy',
              disabled: !codigo,
            },
          ],
        },
        { items: [{ id: 'borrar', label: 'Eliminar', icon: 'trash', danger: true }] },
      ],
      onSelect: (id, f) => {
        if (id === 'bajar') {
          const archivo = f.archivos[0];
          if (!archivo) return;
          void descargarSoporte(projectId, archivo.soporte_id, archivo.filename ?? 'documento').catch(
            (err: unknown) =>
              setError(err instanceof Error ? err.message : 'No se pudo descargar el documento'),
          );
          return;
        }
        if (id === 'cufe') {
          void navigator.clipboard?.writeText(codigo);
          return;
        }
        if (id === 'borrar') {
          // Se elimina el DOCUMENTO, no el archivo suelto: un archivo se va a
          // la papelera con el documento del que es evidencia. Por eso el aviso
          // dice que puede llevarse más de una página — antes borraba una sola
          // y dejaba el documento incompleto sin que nadie lo notara.
          const cuantas = f.archivos.length;
          const aviso =
            cuantas > 1
              ? `¿Eliminar este documento y sus ${cuantas} páginas?`
              : `¿Eliminar ${f.archivos[0]?.filename ?? 'este documento'}?`;
          if (!window.confirm(aviso)) return;
          void eliminarDocumento(projectId, f.id)
            .then(recargar)
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : 'No se pudo eliminar el documento'),
            );
        }
      },
    };
  }

  return (
    <div className="sw-soportes">
      {/* LA FRANJA DE ARRIBA. La barra y los avisos de la subida van juntos —es
          el estado de la acción que vive en la barra—, así que la superficie
          tiene DOS hijos y no cuatro: las filas de `.sw-soportes` son
          `auto minmax(0, 1fr)`, y un tercer hijo caería en una fila implícita
          robándole a la tabla el alto que la hace llenar la pantalla. */}
      <div className="sw-soportes__franja">
      {/* LA TARJETA VA ARRIBA DE TODO porque contesta la pregunta con la que se
          entra —«¿cuánto trabajo me queda?»— y la barra de abajo es lo que se
          hace después de leerla. Cuenta DOCUMENTOS; la tabla lista ARCHIVOS. */}
      <Avance documentos={avance} />

      <div className="sw-soportes__barra">
        <div>
          <p className="sw-soportes__conteo">
            {cargando ? 'Cargando…' : `${total} documento${total === 1 ? '' : 's'}`}
            {extensiones.length > 0 ? ` · se aceptan ${extensiones.join(', ')}` : ''}
          </p>
        </div>

        <div className="sw-soportes__acciones">
          <input
            ref={inputRef}
            type="file"
            multiple
            /* Comodidad, no la puerta: el servidor valida por firma de bytes.
               Un archivo elegido con «todos los archivos» igual se rechaza. */
            accept={extensiones.join(',')}
            hidden
            onChange={(e) => void subir(Array.from(e.target.files ?? []))}
          />
          <button type="button" className="btn" disabled={subiendo} onClick={() => inputRef.current?.click()}>
            <Icon name={subiendo ? 'cargando' : 'subir'} />
            {subiendo && progreso
              ? `Subiendo ${progreso.hecho + 1} de ${progreso.total}…`
              : subiendo
                ? 'Subiendo…'
                : 'Subir documentos'}
          </button>
          {/* EL CANCELAR APARECE SÓLO MIENTRAS HAY ALGO QUE CANCELAR. Un botón
              permanente y apagado el 99% del tiempo ocupa el lugar de la acción
              que sí se usa. Frena la tanda entre un archivo y el siguiente: los
              que ya entraron se quedan, y eso se dice. */}
          {subiendo ? (
            <button
              type="button"
              className="btn"
              data-variant="outline"
              onClick={() => {
                cancelarSubida.current = true;
              }}
            >
              <Icon name="x" />
              Cancelar
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="sw-soportes__aviso sw-soportes__aviso--error">{error}</p> : null}

      {cancelados > 0 ? (
        <p className="sw-soportes__aviso sw-soportes__aviso--parcial">
          Subida cancelada: {cancelados} archivo{cancelados === 1 ? '' : 's'} sin subir. Los que ya
          habían entrado se quedaron.
        </p>
      ) : null}

      {rechazos.length > 0 ? (
        <div className="sw-soportes__aviso sw-soportes__aviso--parcial">
          <p>
            {rechazos.length} archivo{rechazos.length === 1 ? '' : 's'} no se{' '}
            {rechazos.length === 1 ? 'subió' : 'subieron'}:
          </p>
          <ul>
            {rechazos.map((r) => (
              <li key={r.filename}>
                <strong>{r.filename}</strong> — {r.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>

      {/* EL HUECO DE LA TABLA — `.sw-ctb__tabla` del template. Existe para que
          la tabla caiga en una franja con alto definido: es de ahí que sale que
          llene el espacio y scrollee adentro en vez de crecer con sus filas. */}
      <div className="sw-soportes__tabla">
      {/* LA TABLA ES LA DEL TEMPLATE (`components/ui/Tabla`, port de
          `src/accounting/table.js`). Acá se declaran las columnas y cómo se
          pinta cada celda — que es lo que el template llama «el dominio pinta,
          la tabla arma»—, y nada más: el reparto de anchos, el orden de tres
          pasos, la paginación, la casilla maestra y el menú de columnas son
          suyos.

          El vacío y el selector de columnas ya NO se dibujan acá: los trae la
          tabla. Antes había una tabla propia con clases inventadas
          (`sw-tabla__th/__td/__fila/__corte`) que no existen en el template. */}
      <Tabla<DocumentoContable>
        titulo="Documentos"
        columnas={COLUMNAS_DE_TABLA}
        filas={documentos}
        clave={(d) => d.id}
        nombreFila={(d) => d.archivos[0]?.filename ?? d.id}
        seleccion={false}
        menuFila={menuDeFila}
        /* Las catorce restantes no nacen escondidas: nacen AFUERA, y se suman
           con «Agregar una columna…». Es la distinción del template entre lo
           que la tabla dibuja y lo que el dato además tiene. */
        columnasExtra={() => COLUMNAS_MAS}
        porPagina={100}
        opcionesPagina={[100, 150]}
        celda={(doc, col) => celdaDeDocumento(doc, col, (d) => setMirando(d.archivos[0] ?? null))}
        textos={{
          vacio: 'Todavía no hay documentos',
          vacioPaso:
            'Subí las facturas, remisiones y comprobantes que sustentan las operaciones.',
          vacioIcono: 'archivo',
        }}
      />
      </div>

      <Visor projectId={projectId} soporte={mirando} onCerrar={() => setMirando(null)} />
    </div>
  );
}
