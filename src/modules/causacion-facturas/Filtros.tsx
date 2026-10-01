import React from 'react';
import { Icon } from '../../components/Icon.js';
import { Combo, type OpcionDeCombo } from '../../components/ui/Combo.js';
import type { Clasificacion, EstadoDocumento, FacetasDeDocumentos } from '../../lib/causacion-documentos-api.js';

/**
 * LA FILA DE FILTROS — port de `filaDeFiltros()` del template
 * (`src/accounting/accounting.js:1054-1123`, CSS `accounting.css:625-697`).
 *
 * UNA FILA DE COMBOS A LA VISTA Y NO UN POPOVER, con el motivo del template:
 * son criterios que se combinan todo el tiempo —tercero y estado, estado y
 * tipo— y esconderlos detrás de un botón agrega un clic a cada vuelta. Pero
 * sobre todo, vistos así se lee de un golpe POR QUÉ la tabla muestra lo que
 * muestra: un filtro escondido que quedó puesto es la causa número uno de «me
 * faltan documentos».
 *
 * ## Qué cambia respecto del template, y por qué
 *
 * El template tiene cuatro controles: buscar, Proveedor, Estado y Tipo. Acá son
 * cinco, y la diferencia la manda el DOMINIO, no el gusto:
 *
 * - **«Clasificación» no existe allá** porque allá toda factura se causa. Acá un
 *   documento puede ser `COMPLEMENTARIO` —una remisión, una orden, un pago que
 *   respaldan un asiento sin generar uno propio— y separarlos es la primera
 *   pregunta de quien causa.
 * - **«Proveedor» se llama «Tercero»**: el campo es `tercero_nombre` y puede ser
 *   un cliente. Llamarlo proveedor sería decir algo que el dato no dice.
 * - **El tipo de documento no sale de un catálogo cerrado.** Allá es
 *   `PAIS().documentos`; acá lo escribe el extractor como texto libre, así que
 *   las opciones son los valores que REALMENTE hay (las cuenta el servidor).
 *   Mientras eso siga así, dos variantes de la misma palabra son dos opciones.
 *
 * El resto es el template al pie: el orden de los controles, el buscador que se
 * estira, los rótulos al lado de cada combo y «Quitar filtros» que SÓLO EXISTE
 * SI HAY FILTROS — un botón que no hace nada es peor que no tenerlo, porque
 * enseña que los botones de esta pantalla a veces no responden.
 */

export interface EstadoDeFiltros {
  texto: string;
  estado: EstadoDocumento | '';
  clasificacion: Clasificacion | '';
  tercero_nit_cc: string;
  tipo_documento: string;
}

export const FILTROS_VACIOS: EstadoDeFiltros = {
  texto: '',
  estado: '',
  clasificacion: '',
  tercero_nit_cc: '',
  tipo_documento: '',
};

export function hayFiltro(f: EstadoDeFiltros): boolean {
  return !!(f.texto.trim() || f.estado || f.clasificacion || f.tercero_nit_cc || f.tipo_documento);
}

/**
 * Los cuatro estados, con el mismo texto que usa el punto de la tabla.
 *
 * Son un catálogo CERRADO —el eje único del documento— así que se declaran acá
 * y no salen de los datos: un combo que sólo ofrece los estados presentes en la
 * página no deja filtrar por el que falta, que suele ser el que se busca.
 */
const ESTADOS: { id: EstadoDocumento; label: string }[] = [
  { id: 'PENDIENTE_PROCESAR', label: 'Todavía sin procesar' },
  { id: 'PENDIENTE_AUDITAR', label: 'Esperando al contador' },
  { id: 'COMPLETADO', label: 'Válido ante la DIAN' },
  { id: 'AUDITADO', label: 'Causación cerrada' },
];

const CLASIFICACIONES: { id: Clasificacion; label: string }[] = [
  { id: 'PRINCIPAL', label: 'Origina el asiento' },
  { id: 'COMPLEMENTARIO', label: 'Lo acompaña' },
];

/** La opción «todos», que en el template es `todos('', label)`. */
function todos(label: string, resto: OpcionDeCombo[]): OpcionDeCombo[] {
  return [{ id: '', label }, ...resto];
}

export function Filtros({
  valor,
  facetas,
  alCambiar,
}: {
  valor: EstadoDeFiltros;
  facetas: FacetasDeDocumentos;
  alCambiar: (f: EstadoDeFiltros) => void;
}): React.ReactElement {
  const poner = <K extends keyof EstadoDeFiltros>(k: K, v: EstadoDeFiltros[K]): void =>
    alCambiar({ ...valor, [k]: v });

  const terceros = todos(
    'Todos los terceros',
    facetas.terceros
      .filter((t) => t.nit)
      .map((t) => ({ id: t.nit as string, label: t.nombre ?? (t.nit as string) })),
  );
  const tipos = todos(
    'Todos los tipos',
    facetas.tipos.map((t) => ({ id: t.tipo, label: t.tipo })),
  );

  return (
    <div className="sw-soportes__filtros">
      {/* EL ÍCONO VA ENVUELTO EN UN SPAN CON `data-align`, no suelto. Es la
          trampa que el template dejó anotada dos veces: sin el span, Basecoat
          no lo reconoce como addon y no le da relleno, así que el dibujo queda
          a 1px del filete del campo. Y suelto tampoco se arregla con padding —
          sobre un `<svg>` de ancho fijo y `box-sizing: border-box` el relleno
          se come el dibujo en vez de separarlo.

          Y SIN `class="input"` en el campo: `.input-group` YA es la caja con
          borde, y la clase le mete un segundo filete adentro del primero. */}
      <div className="input-group sw-soportes__busca">
        <span data-align="start" className="sw-soportes__blupa" aria-hidden="true">
          <Icon name="search" />
        </span>
        <input
          type="search"
          value={valor.texto}
          placeholder="Busca por CUFE, tercero, NIT o número"
          aria-label="Busca por CUFE, tercero, NIT o número"
          onChange={(e) => poner('texto', e.target.value)}
        />
      </div>

      <Combo
        rotulo="Tercero"
        opciones={terceros}
        valor={valor.tercero_nit_cc}
        alCambiar={(v) => poner('tercero_nit_cc', v)}
      />
      <Combo
        rotulo="Estado"
        opciones={todos('Cualquier estado', ESTADOS)}
        valor={valor.estado}
        alCambiar={(v) => poner('estado', v as EstadoDocumento | '')}
      />
      <Combo
        rotulo="Clasificación"
        opciones={todos('Cualquier clasificación', CLASIFICACIONES)}
        valor={valor.clasificacion}
        alCambiar={(v) => poner('clasificacion', v as Clasificacion | '')}
      />
      <Combo
        rotulo="Tipo"
        opciones={tipos}
        valor={valor.tipo_documento}
        alCambiar={(v) => poner('tipo_documento', v)}
      />

      {/* «QUITAR FILTROS» SÓLO EXISTE SI HAY FILTROS. En el template es
          `limpiar.hidden = !hayFiltro()`; acá no se renderiza, que es lo mismo
          dicho en React. */}
      {hayFiltro(valor) ? (
        <button type="button" className="sw-soportes__limpiar" onClick={() => alCambiar(FILTROS_VACIOS)}>
          <Icon name="escoba" />
          <span>Quitar filtros</span>
        </button>
      ) : null}
    </div>
  );
}
