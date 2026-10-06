import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleViewProps } from '../registry.js';
import { Icon } from '../../components/Icon.js';
import {
  SoporteApiError,
  eliminarDocumento,
  descargarSoporte,
  fetchLimits,
  uploadDocument,
} from '../../lib/causacion-soportes-api.js';
import { COLUMNAS, COLUMNAS_POR_DEFECTO } from './columnas.js';
import { repartirColumnas } from './reparto-de-columnas.js';
import { Tabla, type ColumnaDeTabla } from '../../components/ui/Tabla.js';
import { Avance, Periodo } from './Avance.js';
import { Visor } from './Visor.js';
import {
  buscarGrupos,
  facetasDeDocumentos,
  listarPeriodos,
  resumenDePeriodo,
  type DocumentoContable,
  type EstadoDocumento,
  type FacetasDeDocumentos,
  type GrupoDeDocumentos,
  type ResumenDePeriodo,
} from '../../lib/causacion-documentos-api.js';
import { Filtros, FILTROS_VACIOS, hayFiltro, type EstadoDeFiltros } from './Filtros.js';

import type { GrupoDeMenu } from '../../components/ui/MenuContextual.js';
import { usePublicarSeleccion } from '../../components/layout/seleccion-de-superficie.js';
import { usePreferenciasDeModulo } from '../../hooks/usePreferenciasDeModulo.js';
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

/** La `key` del módulo — la misma que nombra sus permisos y sus tablas. */
const MODULE_KEY = 'causacion-facturas-001';


/** El dominio pinta la celda; la tabla arma la grilla. */
/**
 * «3 páginas · 2 documentos» — las DOS cuentas de una fila, cada una con su
 * sustantivo.
 *
 * Son poblaciones de niveles distintos y por eso se nombran las dos («Agrupar
 * no es relacionar», README del módulo): las páginas son el mismo papel
 * fotografiado varias veces —un documento, un asiento— y los otros son
 * documentos propios, cada uno con su clasificación, su CUFE y su estado. Tres
 * páginas son un asiento; tres documentos, cuatro papeles distintos.
 */
function resumenDelContenido(doc: DocumentoContable, otros: number): string {
  const partes: string[] = [];
  if (doc.archivos.length > 0) {
    partes.push(doc.archivos.length === 1 ? '1 página' : `${doc.archivos.length} páginas`);
  }
  if (otros > 0) partes.push(otros === 1 ? '1 documento' : `${otros} documentos`);
  // Sin archivos y sin grupo no hay nada que resumir, y la celda vacía es lo
  // que el template hace con un dato que no existe.
  return partes.join(' · ');
}

function celdaDeDocumento(
  doc: DocumentoContable,
  col: ColumnaDeTabla,
  abrir: (g: GrupoDeDocumentos) => void,
  grupo: GrupoDeDocumentos | undefined,
): React.ReactNode {
  const def = COLUMNAS.find((c) => c.key === col.id);
  /* EL RESUMEN DE «Contenido» LO ARMA LA VISTA Y NO `columnas.ts`, porque
     necesita el GRUPO y no sólo el documento: `relaciones` son los vínculos
     directos, y el grupo es transitivo (A-B, B-C son tres documentos en una
     fila). Contando las directas, una fila diría «1 documento» y el visor
     mostraría dos. */
  const valor =
    col.id === 'archivos' && grupo
      ? resumenDelContenido(doc, grupo.miembros.length - 1)
      : def
        ? def.leer(doc)
        : '';
  /* Un dato que el extractor no leyó deja la celda VACÍA, sin guion ni
     placeholder: es lo que hace el template (`esc(f[c.dato] == null ? '' : …)`).
     Había un `—` con clase propia, que era UI inventada — y además, con
     veinticuatro columnas, una pantalla de guiones pesa más que el hueco. */
  if (!valor) return null;
  if (col.id === 'archivos') {
    /* UN BOTÓN Y NO UN ENLACE, y el cambio no es de estilo: el `href` iba a la
       URL de descarga, que es una NAVEGACIÓN —sin el `Authorization` que pone
       el interceptor de `fetch`—, así que devolvía 401. Y además lo que hace
       ahora no es ir a ningún lado: abre el visor.

       SIN ÍCONO DE VÍNCULO. Lo tuvo —primero como contador, después como marca—
       y las dos veces sobraba: el resumen de la celda ya dice «3 páginas · 2
       documentos» con el sustantivo al lado, que es más claro que un dibujo que
       hay que aprender. Un segundo canal para lo que el texto ya dice es ruido
       en una columna que se recorre con la vista. */
    if (!valor) return null;
    return (
      <button
        type="button"
        className="sw-soportes__archivo"
        onClick={() => (grupo ? abrir(grupo) : undefined)}
        title="Abrir"
      >
        {valor}
      </button>
    );
  }
  if (col.id === 'estado') return <Estado estado={doc.estado} errorDeImport={doc.importacion_error} />;
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
function Estado({
  estado,
  errorDeImport,
}: {
  estado: EstadoDocumento;
  /**
   * El import dejó el documento SIN archivo (`importacion_error` del backend).
   *
   * Le gana al estado y no es un estado más: el documento sigue estando en
   * `PENDIENTE_PROCESAR` —es lo que la base dice, y el dominio tiene cuatro
   * valores, no cinco—, pero no hay nada que procesar porque la evidencia nunca
   * llegó. Sin esto, una fila rota se pinta igual que una sana en cola: el dato
   * viajaba desde el backend y se descartaba al pintar, y así quedaron 173
   * documentos que parecían pendientes y estaban muertos.
   */
  errorDeImport: string | null;
}): React.ReactElement {
  if (errorDeImport) {
    const dicho = 'No se pudo subir su archivo — volvé a subirlo';
    return (
      <span
        className="sw-tabla__punto"
        data-lleno="true"
        data-tono="error"
        role="img"
        aria-label={dicho}
        /* El motivo crudo va en el `title` y no en la etiqueta accesible: es
           texto de base de datos (un constraint, un ENOENT), útil para quien
           investiga e ilegible para quien sólo quiere saber que hay que
           reintentar. */
        title={`${dicho}\n\n${errorDeImport}`}
      />
    );
  }
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

/**
 * EL PERÍODO ES UN DESPLAZAMIENTO, NO UNA FECHA — es la decisión del template
 * (`mesActivo()` en `accounting.js:176-189`) y vale igual acá.
 *
 * El 0 es el período más nuevo que TIENE documentos, no el mes de hoy. Anclarlo
 * al reloj hace que la pantalla arranque vacía en cuanto nadie suba nada este
 * mes, y eso se lee como un bug y no como un mes sin trabajo.
 *
 * Se mueve por meses de CALENDARIO y no por la lista de períodos con
 * documentos: un mes sin nada tiene que poder mirarse —su vacío es la
 * respuesta— y saltearlo escondería el hueco.
 */
function moverPeriodo(base: string, delta: number): string {
  const [anio, mes] = base.split('-').map(Number);
  const d = new Date(anio ?? 1970, (mes ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** «Junio de 2026» — `nombreMes()` del template, con su mayúscula inicial. */
function nombreDePeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const texto = new Date(anio ?? 1970, (mes ?? 1) - 1, 1).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function View({ projectId }: ModuleViewProps): React.ReactElement {
  const [grupos, setGrupos] = useState<GrupoDeDocumentos[]>([]);
  const [total, setTotal] = useState(0);

  /* EL SEGUNDO RENGLÓN DEL TÍTULO. El template lo arma con
     `[mod.sub, val].filter(Boolean)`: la descripción la declara el módulo, la
     CUENTA la publica la superficie viva. Una cuenta sin sujeto no dice nada
     —«17» no se sabe de qué— y por eso va debajo de la descripción, no sola. */
  const [marcados, setMarcados] = useState<string[]>([]);

  /* LAS COLUMNAS QUE ESTA PERSONA DEJÓ LA ÚLTIMA VEZ.
     Veintiuna columnas y siete por default: quien trabaja todos los días acá
     arma su juego una vez y no tiene por qué rearmarlo en cada recarga. El
     mecanismo es transversal (`usePreferenciasDeModulo`) — este módulo sólo
     elige qué guarda y con qué clave. */
  const { prefs, listas: prefsListas, guardar: guardarPrefs } = usePreferenciasDeModulo(MODULE_KEY);
  const columnasGuardadas = Array.isArray(prefs.columnas) ? (prefs.columnas as string[]) : null;
  const { columnasDeTabla, columnasExtra } = useMemo(
    () => repartirColumnas(columnasGuardadas, COLUMNAS.map(aColumnaDeTabla), COLUMNAS_DE_TABLA, COLUMNAS_MAS),
    [columnasGuardadas],
  );
  /* QUÉ SE PUBLICA, y por qué tan poco: esto termina en el prompt del chat.
     Van los ids y —sólo si son pocos— cómo se llaman, para que puedas decir
     «causá éste». El contenido no: si el modelo lo necesita, lo trae con una
     tool. Es la misma economía que hace que el contrato de un BC se lea con
     `bc_get` en vez de inyectarse en cada turno. */
  /* UNA FILA POR GRUPO, y el reparto lo hace el SERVIDOR. Dos documentos
     atados con `relacionar` son UN trabajo para quien causa, así que ocupan una
     línea: la del `PRINCIPAL`, o la del primero si el grupo no tiene ninguno.

     Estuvo acá y se mudó al backend porque la agrupación es del DOMINIO —
     contesta cuántos asientos quedan, no cómo se dibuja una tabla— y porque la
     tarjeta de arriba cuenta sobre TODO el período: agrupando en el cliente
     sólo podía contar lo que la página trajo. */
  const filas = useMemo(() => grupos.map((g) => g.duenio), [grupos]);
  const grupoDe = useMemo(() => new Map(grupos.map((g) => [g.duenio.id, g])), [grupos]);

  const seleccion = useMemo(() => {
    if (marcados.length === 0) return null;
    const todos = grupos.flatMap((g) => g.miembros);
    const nombres = marcados
      .map((id) => todos.find((d) => d.id === id)?.archivos[0]?.filename)
      .filter((n): n is string => !!n);
    return {
      kind: 'documento',
      ids: marcados,
      label: marcados.length <= 3 && nombres.length === marcados.length ? nombres.join(', ') : undefined,
    };
  }, [marcados, grupos]);
  usePublicarSeleccion(seleccion);

  usePublicarMedida(total ? `${total} ${total === 1 ? 'documento' : 'documentos'}` : null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazos, setRechazos] = useState<Rechazo[]>([]);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [extensiones, setExtensiones] = useState<string[]>([]);
  /**
   * El DOCUMENTO que se está mirando. `null` = el visor está cerrado.
   *
   * Es el documento y no uno de sus archivos, porque el visor muestra las dos
   * cosas: la evidencia (su primera página) y CON QUÉ ESTÁ RELACIONADO. Un
   * archivo suelto no tiene vínculos — los tiene el documento.
   */
  const [mirando, setMirando] = useState<GrupoDeDocumentos | null>(null);
  const abrirVisor = useCallback((g: GrupoDeDocumentos) => setMirando(g), []);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- EL PRIMER RECORTE: el período ----------------------------------- */

  /**
   * Los períodos que tienen documentos, de donde sale el mes base.
   *
   * `null` mientras no se sabe: es distinto de «no hay ninguno», y la
   * diferencia importa — con la lista vacía de verdad, el navegador no se
   * dibuja (no hay meses que recorrer) y la tabla no recorta por período.
   */
  const [periodos, setPeriodos] = useState<string[] | null>(null);
  /** Desplazamiento en meses desde el más nuevo con documentos. 0 = ése. */
  const [mes, setMes] = useState(0);
  const [filtros, setFiltros] = useState<EstadoDeFiltros>(FILTROS_VACIOS);
  const [facetas, setFacetas] = useState<FacetasDeDocumentos>({ terceros: [] });

  const base = periodos?.[0] ?? null;
  const periodo = base ? moverPeriodo(base, mes) : null;

  /**
   * El recorte que comparten la tabla, la tarjeta y los combos.
   *
   * `incluir_sin_periodo` va SIEMPRE que haya período: un documento que la IA
   * todavía no analizó no tiene fecha, así que no es de ningún mes — y es el
   * que acaba de entrar. Escondérselo a quien acaba de subir veinte archivos
   * sería mostrarle una tabla vacía.
   */
  const recorte = periodo ? { periodo, incluir_sin_periodo: true } : {};

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      /* LA TABLA: una fila por GRUPO, con los filtros puestos y paginada. El
         reparto lo hace el servidor — ver `causacion-agrupacion.ts`. */
      const r = await buscarGrupos(projectId, {
        ...recorte,
        ...(filtros.texto.trim() ? { texto: filtros.texto.trim() } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.clasificacion ? { clasificacion: filtros.clasificacion } : {}),
        ...(filtros.tercero_nit_cc ? { tercero_nit_cc: filtros.tercero_nit_cc } : {}),
        ...(filtros.tipo_documento ? { tipo_documento: filtros.tipo_documento } : {}),
        limit: 200,
      });
      setGrupos(r.grupos);
      setTotal(r.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los documentos');
    } finally {
      setCargando(false);
    }
    // `recorte` se deriva de `periodo`, que ya está en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, periodo, filtros]);

  /**
   * LA TARJETA SE PIDE APARTE, y es la regla que ordena esta pantalla:
   *
   * | | alcance | paginado | filtros |
   * |---|---|---|---|
   * | la tabla | la página que se mira | sí | sí |
   * | la tarjeta | **todo el período** | no | **no** |
   *
   * Lo primero: sacada de la misma respuesta que la tabla, la tarjeta sólo
   * podía contar lo que la página trajo — con 800 documentos en el mes y 200
   * cargados, decía que falta un cuarto de lo que falta.
   *
   * Lo segundo: **narra el período, no lo que se está mirando**. Es la decisión
   * del template, con su motivo escrito al lado: siguiendo al filtro, «17 de
   * 28» se vuelve «1 de 1» al elegir un tercero, y filtrar a algo que no existe
   * la deja diciendo «todavía no hay documentos», que es falso — hay 28, no
   * cumplen el filtro. Quieta mientras la tabla se achica, es el ancla contra
   * la cual se lee el recorte.
   *
   * Por eso depende del PERÍODO y no de los filtros, y por eso se recarga
   * también cuando la tabla cambia por una subida o un borrado.
   */
  const [avance, setAvance] = useState<ResumenDePeriodo | null>(null);
  const recargarAvance = useCallback(async () => {
    try {
      setAvance(await resumenDePeriodo(projectId, recorte));
    } catch {
      /* La tarjeta que no carga no voltea la pantalla: la tabla es lo que hay
         que ver, y un resumen viejo o ausente no impide trabajar. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, periodo]);

  useEffect(() => {
    // Los períodos se piden una vez por proyecto: cambian cuando la IA le pone
    // fecha a un documento, no mientras se mira la tabla.
    void listarPeriodos(projectId)
      .then((ps) => setPeriodos(ps.map((p) => p.periodo)))
      .catch(() => setPeriodos([]));
    // Los formatos aceptados los decide el SERVIDOR; se piden en vez de
    // escribirlos acá para que el `accept` del input no se desincronice de lo
    // que la validación realmente permite.
    void fetchLimits(projectId)
      .then((l) => setExtensiones(l.extensiones))
      .catch(() => setExtensiones([]));
  }, [projectId]);

  /**
   * UNA ESPERA ANTES DE CONSULTAR, y es la única desviación del template en
   * toda la fila de filtros.
   *
   * Allá `filtradas()` recorre un arreglo en memoria, así que refrescar en cada
   * tecla es gratis. Acá cada cambio es una consulta al servidor: sin esta
   * pausa, escribir «factura» son siete, y la respuesta de la cuarta puede
   * llegar después de la séptima y pintar la tabla con un resultado viejo.
   *
   * Corre también en el primer render (sin filtros puestos), que es la carga
   * inicial de la pantalla.
   */
  useEffect(() => {
    // Hasta no saber qué períodos hay no se puede recortar, y pedir sin el
    // recorte traería el universo entero para tirarlo un instante después.
    if (periodos === null) return;
    const t = setTimeout(() => void recargar(), 250);
    return () => clearTimeout(t);
  }, [periodos, recargar]);

  /* La tarjeta NO espera a los filtros: depende del período y nada más, así
     que escribir en el buscador no la hace pedir de nuevo. */
  useEffect(() => {
    if (periodos === null) return;
    void recargarAvance();
  }, [periodos, recargarAvance]);

  /* El combo de TERCEROS se puebla con lo que hay en el período que se está
     mirando, no con todo el histórico: una opción sin documentos en el mes
     abierto lleva a una tabla vacía, y eso se lee como que el filtro se rompió.
     Depende del período y NO de los filtros — un combo que se recorta a sí mismo
     deja sin forma de volver atrás.

     Los otros cuatro no se consultan: son catálogos cerrados y se declaran. */
  useEffect(() => {
    if (periodos === null) return;
    void facetasDeDocumentos(projectId, recorte)
      .then(setFacetas)
      .catch(() => setFacetas({ terceros: [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, periodos, periodo]);

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
    setSubiendo(true);
    setProgreso({ hecho: 0, total: files.length });
    setError(null);
    const fallidos: Rechazo[] = [];

    for (const [i, file] of files.entries()) {
      try {
        /* El `File` viaja entero: lo sube `FormData` en multipart y el browser
           hace el streaming. Antes había un paso previo —leerlo a base64 con un
           `FileReader`— que tenía el archivo dos veces en memoria sólo para
           poder meterlo en un JSON. */
        await uploadDocument(projectId, { file });
      } catch (err) {
        const motivo = err instanceof SoporteApiError || err instanceof Error ? err.message : 'no se pudo subir';
        fallidos.push({ filename: file.name, motivo });
      }
      setProgreso({ hecho: i + 1, total: files.length });
    }

    setRechazos(fallidos);
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
      <Avance
        resumen={avance}
        periodo={
          /* SIN PERÍODOS NO HAY NAVEGADOR, y no es un caso de borde: un
             proyecto que recién empieza tiene todo sin fecha, así que no hay
             meses que recorrer. Dibujar flechas que mueven un mes que no existe
             es ofrecer una navegación falsa. */
          base ? (
            <Periodo
              etiqueta={periodo ? nombreDePeriodo(periodo) : ''}
              alMover={(d) => setMes((m) => m + d)}
              /* Como en el template (`estado.mes >= 0 ? disabled`): hacia
                 adelante del mes más nuevo con documentos no hay nada. */
              haySiguiente={mes < 0}
            />
          ) : null
        }
      />

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
        </div>
      </div>

      {error ? <p className="sw-soportes__aviso sw-soportes__aviso--error">{error}</p> : null}

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
        /* El `key` fuerza a remontar cuando llegan las preferencias: las
           columnas visibles son estado interno de la tabla, y sin esto la
           lista guardada no se aplicaría hasta que el usuario tocara el menú.
           Con el caché local ya listo en el primer render esto no dispara —
           queda para la primera visita desde un browser nuevo, que es el único
           caso en que el salto es inevitable. */
        key={prefsListas ? 'con-prefs' : 'sin-prefs'}
        columnas={columnasDeTabla}
        filas={filas}
        clave={(d) => d.id}
        nombreFila={(d) => d.archivos[0]?.filename ?? d.id}
        /* LA CASILLA DEL TEMPLATE. No es adorno: lo marcado se publica para
           que el chat sepa de qué documentos le estás hablando, y así podés
           decirle «causá éstos» en vez de pegarle ids. */
        seleccion
        onSeleccionar={({ claves }) => setMarcados(claves)}
        menuFila={menuDeFila}
        /* Las catorce restantes no nacen escondidas: nacen AFUERA, y se suman
           con «Agregar una columna…». Es la distinción del template entre lo
           que la tabla dibuja y lo que el dato además tiene. */
        columnasExtra={() => columnasExtra}
        /* Se guarda lo que quedó visible, no el diff. Si el usuario vuelve a
           los defaults, eso también es su preferencia. */
        onColumnas={(visibles) => guardarPrefs({ ...prefs, columnas: visibles })}
        porPagina={100}
        opcionesPagina={[100, 150]}
        celda={(doc, col) => celdaDeDocumento(doc, col, abrirVisor, grupoDe.get(doc.id))}
        /* LA BANDA DE LA TABLA, que es donde el template monta los filtros
           (`encabezado: filaDeFiltros()`): gobiernan ESTA tabla, así que van
           pegados a ella y no sueltos sobre el lienzo. */
        encabezado={<Filtros valor={filtros} facetas={facetas} alCambiar={setFiltros} />}
        textos={
          /* EL VACÍO DICE CUÁL DE LOS DOS VACÍOS ES. «Todavía no hay
             documentos» con un filtro puesto es falso y manda a subir archivos
             a quien ya los tiene: lo que no hay es documentos QUE CUMPLAN. El
             template parte el texto por lo mismo (`L.vacio.sinFiltro` contra
             `L.vacio.nada` en `textosDeVacio()`). */
          hayFiltro(filtros)
            ? {
                vacio: 'Ningún documento cumple con los filtros puestos',
                vacioPaso: 'Probá quitando alguno.',
                vacioIcono: 'filter',
              }
            : {
                vacio: 'Todavía no hay documentos',
                vacioPaso:
                  'Subí las facturas, remisiones y comprobantes que sustentan las operaciones.',
                vacioIcono: 'archivo',
              }
        }
      />
      </div>

      <Visor projectId={projectId} grupo={mirando} onCerrar={() => setMirando(null)} />
    </div>
  );
}
