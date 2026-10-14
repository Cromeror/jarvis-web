import type { CatalogModule, CatalogSuite } from './catalog-api.js';

/**
 * LA FICHA DE UN MÓDULO: para quién es, dónde aparece y por dónde llega.
 *
 * Existe porque el nombre no alcanza. «Red de contexto» son DOS módulos
 * —`MOD-0004`, el del espacio, y `MOD-0007`, el de la organización— y en una
 * lista que sólo muestra nombres no hay forma de saber cuál es cuál ni a quién
 * le sirve. Lo que los distingue son los dos ejes de
 * `docs/05-ambito-de-los-modulos.md` del workspace:
 *
 * - **catálogo** (`ambito`): para quién es —el equipo de un espacio, o la
 *   organización como tal—;
 * - **superficie**: dónde se muestra —el riel, o el modal de Ajustes—.
 *
 * Los textos salen sólo de esos dos campos; acá no se decide nada nuevo.
 * El tercer catálogo, el de instalación (el operador), no aparece nunca: no se
 * vende, así que no llega a `catalog_modules`.
 */

export type ParaQuien = 'espacio' | 'organizacion';

export interface FichaDeModulo {
  /** El código (`MOD-0004`), o `null` para un módulo manual que todavía no lo tiene. */
  codigo: string | null;
  paraQuien: ParaQuien;
  /** Rótulo corto para una pastilla: «Espacio» / «Organización». */
  paraQuienCorto: string;
  /** Quién lo usa, en una frase. */
  quienLoUsa: string;
  /** Dónde lo encuentra quien lo usa: «Riel» o «Ajustes → Organización». */
  dondeAparece: string;
  /** Rótulo corto para una pastilla: «Riel» / «Ajustes». */
  dondeCorto: string;
  /** Las suites que lo traen: es la única forma de que le llegue a alguien. */
  suites: string[];
  /** Cómo le llega a quien lo usa, dicho según las suites que lo traen. */
  comoLlega: string;
}

export function paraQuienDe(m: Pick<CatalogModule, 'ambito'>): ParaQuien {
  return m.ambito === 'organizacion' ? 'organizacion' : 'espacio';
}

export function fichaDeModulo(
  m: Pick<CatalogModule, 'id' | 'key' | 'ambito' | 'superficie'>,
  suites: readonly Pick<CatalogSuite, 'name' | 'modules'>[],
): FichaDeModulo {
  const paraQuien = paraQuienDe(m);
  const deOrg = paraQuien === 'organizacion';
  const enAjustes = m.superficie === 'ajustes';
  const traen = suites.filter((s) => s.modules.some((x) => x.id === m.id)).map((s) => s.name);

  return {
    codigo: m.key,
    paraQuien,
    paraQuienCorto: deOrg ? 'Organización' : 'Espacio',
    quienLoUsa: deOrg
      ? 'Quien administra o supervisa la organización, por encima de sus espacios. Lo ve según los permisos de su rol de organización.'
      : 'El equipo de un espacio, sobre su propio espacio. Lo ve según los permisos de su rol en ese espacio.',
    dondeAparece: enAjustes ? `Ajustes → ${deOrg ? 'Organización' : 'Espacio'}` : 'Riel (la navegación)',
    dondeCorto: enAjustes ? 'Ajustes' : 'Riel',
    suites: traen,
    comoLlega:
      traen.length === 0
        ? 'Ninguna suite lo trae: hoy no le llega a nadie.'
        : deOrg
          ? 'Una organización lo tiene si alguno de sus espacios tiene una de estas suites.'
          : 'Lo tiene cada espacio que tenga una de estas suites.',
  };
}

/**
 * El nombre para una lista donde puede repetirse: si otro módulo se llama
 * igual, se le agrega para quién es. Si no se repite, queda tal cual —agregarlo
 * siempre sería ruido—.
 */
export function nombreDistinguible(
  m: Pick<CatalogModule, 'id' | 'name' | 'ambito'>,
  todos: readonly Pick<CatalogModule, 'id' | 'name'>[],
): string {
  const repetido = todos.some((o) => o.id !== m.id && o.name.trim().toLowerCase() === m.name.trim().toLowerCase());
  if (!repetido) return m.name;
  return `${m.name} (${paraQuienDe(m) === 'organizacion' ? 'organización' : 'espacio'})`;
}
