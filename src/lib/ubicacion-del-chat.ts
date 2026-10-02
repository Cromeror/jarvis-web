import type { CatalogSuite } from './catalog-api.js';

/**
 * DÓNDE ESTÁ PARADO EL USUARIO, para estampárselo al mensaje que manda.
 *
 * El chat flota sobre todo y no es de ninguna superficie, así que no sabe en
 * qué pantalla lo invocaron. Esto lo deriva de la URL.
 *
 * ## Tres decisiones que son el mecanismo, no el detalle
 *
 * - **Se estampa al ENVIAR, no al navegar.** No hay evento de navegación, no
 *   hay suscripción, no hay nada que se dispare mientras el usuario pasea: la
 *   ubicación viaja con el mensaje que ya se iba a mandar. Navegar en silencio
 *   cuesta exactamente cero.
 * - **Va la `key` del módulo, no su slug.** El slug es la URL y se renombra
 *   desde la pantalla del catálogo; la `key` lleva el id (`causacion-facturas-001`),
 *   no cambia nunca, y es lo que nombra sus permisos y sus tablas. Decirle al
 *   modelo el slug sería darle un identificador que mañana apunta a otra cosa.
 * - **Lo que no se puede resolver, no se inventa.** Sin suites cargadas no hay
 *   `key`, y entonces se manda sólo lo que sí se sabe. Un campo ausente es
 *   información faltante; uno adivinado es información falsa.
 */
export interface UbicacionDelChat {
  surface?: string;
  module?: string;
  view?: string;
  /**
   * Lo que el usuario tiene señalado en la superficie.
   *
   * No sale de la URL —cambia con cada clic— sino del canal que publica el
   * módulo (`seleccion-de-superficie.tsx`). Por eso `ubicacionDe` la recibe en
   * vez de derivarla: la URL no la sabe.
   */
  selection?: { kind: string; ids: string[]; label?: string };
}

/** `/suites/:projectId/:suiteSlug/:moduleSlug?` — la única ruta con superficie y módulo. */
const RUTA_DE_SUITE = /^\/suites\/[^/]+\/([^/?#]+)(?:\/([^/?#]+))?/;

/**
 * La ubicación que corresponde a un pathname.
 *
 * `suites` es opcional y sólo sirve para traducir el slug del módulo a su
 * `key`. Sin ellas la ubicación igual se manda — con el slug como está en la
 * URL—, porque saber que el usuario está en una superficie ya desambigua más
 * que no saber nada.
 */
export function ubicacionDe(
  pathname: string,
  suites?: readonly CatalogSuite[],
  seleccion?: UbicacionDelChat['selection'] | null,
): UbicacionDelChat | null {
  const conSeleccion = (base: UbicacionDelChat | null): UbicacionDelChat | null => {
    if (!seleccion || seleccion.ids.length === 0) return base;
    return { ...(base ?? {}), selection: seleccion };
  };

  const m = RUTA_DE_SUITE.exec(pathname);
  if (!m) {
    // Fuera de una superficie se nombra la pantalla y nada más: el chat en
    // Planes o en Entornos es un contexto distinto del chat en un módulo.
    const primero = pathname.split('/').filter(Boolean)[0];
    return conSeleccion(primero ? { view: primero } : null);
  }

  const [, suiteSlug, moduleSlug] = m;
  const suite = suites?.find((s) => s.slug === suiteSlug);
  // Sin moduleSlug la superficie muestra su primer módulo — la misma regla que
  // `SuitePage`, para que la ubicación diga lo que el usuario está viendo y no
  // lo que la URL omitió.
  const modulo = moduleSlug ? suite?.modules.find((x) => x.slug === moduleSlug) : suite?.modules[0];

  const out: UbicacionDelChat = { surface: suiteSlug };
  const key = modulo?.key ?? moduleSlug;
  if (key) out.module = key;
  return conSeleccion(out);
}
