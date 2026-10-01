/**
 * Agrupa una lista de permisos por el módulo al que pertenecen.
 *
 * Existe porque una fila de chips planos —`project:read`, `chat:write`,
 * `environments-002:read`, `environments-002:run`…— no deja ver lo único que se
 * mira en esa celda: de qué puede ocuparse este rol. Con nueve permisos de tres
 * familias mezclados, contar cuáles son de un módulo es trabajo del lector.
 *
 * **La partición es por la forma del nombre, no por una tabla.** Un permiso de
 * módulo es `<nombre>-<NNN>:<acción>` (`causacion-facturas-001:read`); el id de
 * tres dígitos es justamente lo que lo separa de uno transversal
 * (`chat:write`). Es la misma convención que `assertModulePermissions` verifica
 * al arrancar, así que acá no se inventa un criterio nuevo: se lee el que ya
 * existe.
 *
 * **El rótulo del grupo es la `key` cruda del módulo**, no un nombre lindo
 * derivado. Embellecerlo —sacarle el id, capitalizar— produciría un texto que
 * no coincide con ningún otro lugar del producto y que, peor, borra el id: lo
 * único que de verdad distingue un módulo de otro.
 */

/** Lo transversal va primero y junto: es el piso sobre el que se leen los módulos. */
export const GRUPO_PLATAFORMA = 'Plataforma';

export interface GrupoDePermisos {
  /** `Plataforma`, o la `key` del módulo (`causacion-facturas-001`). */
  titulo: string;
  /** `true` sólo para el grupo transversal. */
  plataforma: boolean;
  /** Lo que se dibuja en cada chip: la acción (`read`) en un módulo, el permiso entero afuera. */
  items: Array<{ permiso: string; etiqueta: string }>;
}

/** `<algo>-<tres dígitos>:<acción>` — ver el comentario de arriba. */
const DE_MODULO = /^(.+-\d{3}):(.+)$/;

export function agruparPorModulo(permisos: readonly string[]): GrupoDePermisos[] {
  const plataforma: GrupoDePermisos = { titulo: GRUPO_PLATAFORMA, plataforma: true, items: [] };
  const porModulo = new Map<string, GrupoDePermisos>();

  for (const permiso of permisos) {
    const m = DE_MODULO.exec(permiso);
    if (!m) {
      plataforma.items.push({ permiso, etiqueta: permiso });
      continue;
    }
    const [, key, accion] = m;
    let grupo = porModulo.get(key);
    if (!grupo) {
      grupo = { titulo: key, plataforma: false, items: [] };
      porModulo.set(key, grupo);
    }
    grupo.items.push({ permiso, etiqueta: accion });
  }

  // Los módulos en orden alfabético por key: con el id adentro, eso agrupa
  // también las versiones de un mismo nombre. El orden DENTRO de cada grupo se
  // respeta tal cual viene — es el del catálogo, que ya está pensado.
  const modulos = [...porModulo.values()].sort((a, b) => a.titulo.localeCompare(b.titulo));
  return plataforma.items.length > 0 ? [plataforma, ...modulos] : modulos;
}
