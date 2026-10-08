import React from 'react';
import { Select } from 'radix-ui';
import { Icon } from '../Icon.js';

/**
 * EL COMBO DE UN FILTRO — port de `combo()` del template
 * (`src/accounting/accounting.js:246-295`).
 *
 * Es rótulo + disparador, los dos adentro de `.sw-ctb__campo`: el rótulo va AL
 * LADO del control y no arriba, y en tinta de texto y no en `muted` — el
 * template lo tiene anotado en su CSS, porque apagados «la fila se leía como
 * cuatro controles sin nombre».
 *
 * BASECOAT PONE EL ASPECTO, RADIX EL COMPORTAMIENTO, que es la regla ya
 * validada en este repo (`shell/UserMenu.tsx`, y el test
 * `theme/__tests__/basecoat-solo-css.spec.ts` la fija): el JS de Basecoat muta
 * el DOM por detrás de React —45 `setAttribute`, 14 `classList`, 4 `innerHTML`
 * medidos sobre el bundle del template— así que de la librería entra sólo el
 * CSS y el foco, el teclado, el Escape y el ARIA los pone Radix DESDE React.
 *
 * Cuatro trampas que eso trae, y cómo se resuelven acá:
 *
 * · EL WRAPPER `.select` ES OBLIGATORIO: todo el CSS de Basecoat para este
 *   componente cuelga de él (`.select:not(select) > button`,
 *   `.select:not(select) [role=option]`). Y el `:not(select)` es lo que separa
 *   este combo del `<select>` nativo, así que la clase va en un `<div>`.
 * · EL CONTENT VA SIN `<Portal>`, igual que el menú de usuario: portalado al
 *   `body` se corta la cadena de descendencia y no le llega una sola regla.
 * · EL CHECK DE LA OPCIÓN ELEGIDA lo dibuja Basecoat con
 *   `[role=option][aria-selected=true]`, y Radix pone `aria-selected` sólo
 *   cuando la opción además está ENFOCADA. Por eso el `data-state="checked"`
 *   que Radix sí mantiene se traduce a `aria-selected` en el markup
 *   (`SelectItem` de abajo): sin eso, el combo cerrado y vuelto a abrir no
 *   muestra cuál es el valor puesto.
 * · CADA OPCIÓN LLEVA `data-value`, que es como Basecoat CUENTA las opciones:
 *
 *     .select:not(select) [role=listbox]:not([data-empty])
 *       :not(:has([data-value]:not([aria-hidden=true]))):before
 *       { content: "No results found" }
 *
 *   Radix no lo emite —su valor viaja por contexto—, así que el listbox se le
 *   veía VACÍO a Basecoat y todo combo abría con un «No results found» en
 *   inglés arriba de sus opciones, que sí estaban ahí. El template lo pone a
 *   mano en cada opción (`data-value="' + esc(o.id) + '"`, `accounting.js`),
 *   o sea que es parte del contrato del componente y no un detalle de su JS.
 *
 * `position="popper"` y no el default: el default alinea el popover sobre la
 * opción elegida —el combo salta de lugar según qué haya seleccionado— y el
 * template despliega siempre debajo del disparador.
 */

export interface OpcionDeCombo {
  /** `''` es la opción «todos»: la ausencia de filtro es un valor más del combo. */
  id: string;
  label: string;
}

/**
 * EL VALOR VACÍO NO PUEDE SER `''` PARA RADIX.
 *
 * Radix reserva la cadena vacía para «sin elegir» y tira si una opción la usa
 * como `value`. Pero en el template la opción «Todos los proveedores» ES una
 * opción con id `''` —elegirla es una acción, no la ausencia de una—, así que
 * se la traduce en el borde: hacia adentro viaja este centinela, hacia afuera
 * siempre `''`. El dominio no se entera.
 */
const TODOS = '__todos__';

export function Combo({
  rotulo,
  opciones,
  valor,
  alCambiar,
}: {
  rotulo: string;
  opciones: OpcionDeCombo[];
  valor: string;
  alCambiar: (v: string) => void;
}): React.ReactElement {
  /* El template elige `opciones.find(o => o.id === actual) || opciones[0]`: un
     valor que ya no está en la lista —el proveedor que se fue al cambiar de
     mes— cae en la primera opción, que es «todos». Mismo criterio acá. */
  const elegida = opciones.find((o) => o.id === valor) ?? opciones[0];

  return (
    <div className="sw-ctb__campo">
      <span className="sw-ctb__lab">{rotulo}</span>
      <Select.Root
        value={elegida?.id === '' ? TODOS : (elegida?.id ?? TODOS)}
        onValueChange={(v) => alCambiar(v === TODOS ? '' : v)}
      >
        <div className="select sw-ctb__sel">
          <Select.Trigger asChild>
            <button type="button" aria-label={rotulo}>
              {/* `.truncate` lo pide el CSS del template: el nombre de un
                  tercero no entra en 128px y tiene que cortarse, no empujar. */}
              <Select.Value asChild>
                <span className="truncate">{elegida?.label ?? ''}</span>
              </Select.Value>
              <Icon name="chevron" />
            </button>
          </Select.Trigger>

          <Select.Content data-popover position="popper" sideOffset={4}>
            <Select.Viewport>
              {opciones.map((o) => (
                <SelectItem key={o.id} valor={o.id === '' ? TODOS : o.id} elegido={o.id === elegida?.id}>
                  {o.label}
                </SelectItem>
              ))}
            </Select.Viewport>
          </Select.Content>
        </div>
      </Select.Root>
    </div>
  );
}

/**
 * Una opción, con los dos atributos que Basecoat necesita y Radix no emite:
 * `aria-selected` para dibujar su check y `data-value` para contarla como
 * opción — ver la tercera y la cuarta trampa, arriba.
 */
function SelectItem({
  valor,
  elegido,
  children,
}: {
  valor: string;
  elegido: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    /* `aria-selected` SIEMPRE con valor, no sólo en la elegida: el `undefined`
       borraba el atributo en las demás, y una opción de listbox sin él no dice
       que NO está elegida — lo deja sin decir. Radix esparce los props después
       de los suyos, así que éste es el que queda.

       `data-value` es lo que le dice a Basecoat que esta opción existe — ver la
       cuarta trampa, arriba. */
    <Select.Item value={valor} data-value={valor} aria-selected={elegido}>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  );
}
