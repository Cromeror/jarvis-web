import type { ColumnaDeTabla } from './anchos-de-tabla.js';

/**
 * QUÉ COLUMNAS SE VEN — la parte de `Tabla` que es datos → datos, y por lo
 * tanto la única que este repo puede fijar con un test (`vitest.config.ts`:
 * sólo lógica pura, sin jsdom). Mismo criterio que `anchos-de-tabla.ts`.
 *
 * Vive afuera del componente porque las dos funciones de abajo tuvieron un bug
 * cada una, y los dos eran invisibles desde adentro:
 *
 * - `onColumnas` se avisaba al tildar en el menú de ajustes pero **no** al
 *   agregar una columna, aunque agregar también cambia qué se ve. Quien
 *   persistía la preferencia guardaba los destildes y perdía los agregados.
 * - Al volver una columna agregada desde la preferencia guardada, quedaba en
 *   `columnas` Y en `agregadas` a la vez, y se dibujaba dos veces.
 */

/**
 * Las columnas que la tabla tiene, sin repetir.
 *
 * Gana la declarada por el consumidor: es la que trae el orden que él decidió.
 * La copia que quedó en `agregadas` se descarta.
 */
export function unirColumnas(
  declaradas: readonly ColumnaDeTabla[],
  agregadas: readonly ColumnaDeTabla[],
): ColumnaDeTabla[] {
  const vistos = new Set<string>();
  return [...declaradas.filter(Boolean), ...agregadas].filter((c) => {
    if (vistos.has(c.id)) return false;
    vistos.add(c.id);
    return true;
  });
}

/**
 * Lo que `onColumnas` reporta: los ids visibles, en orden.
 *
 * Una sola función para los DOS caminos que cambian la visibilidad —tildar y
 * agregar— porque tenerla duplicada es exactamente cómo uno de los dos se
 * quedó sin avisar.
 */
export function idsVisibles(
  columnas: readonly ColumnaDeTabla[],
  ocultas: ReadonlySet<string>,
): string[] {
  return columnas.filter((c) => !ocultas.has(c.id)).map((c) => c.id);
}

/**
 * Qué queda oculto al tildar `id`.
 *
 * **Nunca todas escondidas**: una tabla sin columnas son cien filas vacías y no
 * hay forma de volver desde adentro de ella, así que el último destilde se
 * ignora.
 */
export function alternarOculta(
  ocultas: ReadonlySet<string>,
  id: string,
  totalDeclaradas: number,
): Set<string> {
  const s = new Set(ocultas);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  if (s.size === totalDeclaradas) s.delete(id);
  return s;
}
