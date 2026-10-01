import type { CatalogSuite } from './catalog-api.js';

/**
 * LAS MIGAS — dónde estás, en la franja 2 del topbar.
 *
 * El template deja la franja en el chasis (`sw-topbar__migas`) y la nace
 * `hidden`: quien la llena es cada superficie. Esto es lo que la llena.
 *
 * La regla que más se rompe en un breadcrumb, y por eso está en el tipo: **la
 * última miga NO es un enlace**, es donde estás. Un `to` ausente es eso, y no
 * un dato que faltó.
 *
 * Se deriva de la RUTA y no de un estado propio porque la ubicación ya está en
 * la URL: un segundo lugar donde decir dónde estás es un segundo lugar que se
 * desincroniza — y la forma en que se nota es que las migas dicen una cosa y el
 * riel marca otra.
 */

export interface Miga {
  label: string;
  /** Ausente = es la última, o sea donde estás. */
  to?: string;
}

/** El nombre de la sección, para las superficies que no son un módulo. */
const SECCIONES: Record<string, string> = {
  chat: 'Chat',
  plans: 'Planes',
  environments: 'Environments',
  workspaces: 'Workspaces',
  catalogo: 'Catálogo',
  puertos: 'Puertos',
  users: 'Usuarios',
};

export function migasDeLaRuta(entrada: {
  pathname: string;
  suites: CatalogSuite[];
  projectId: string | null;
}): Miga[] {
  const { pathname, suites, projectId } = entrada;
  const [, seccion, ...resto] = pathname.split('/').filter((s, i) => i === 0 || s.length > 0);

  // La raíz. En el Dashboard es la única, y como es donde estás, no es enlace.
  const raiz: Miga = { label: 'Jarvis', to: '/' };
  if (!seccion) return [{ label: 'Jarvis' }];

  if (seccion !== 'suites') {
    const label = SECCIONES[seccion];
    return label ? [raiz, { label }] : [raiz];
  }

  // `/suites/:projectId/:suiteSlug/:moduleSlug`
  const [, suiteSlug, moduleSlug] = resto;
  const suite = suites.find((s) => s.slug === suiteSlug);
  if (!suite || !projectId) return [raiz];

  const migas: Miga[] = [raiz];
  const modulo = moduleSlug ? suite.modules.find((m) => m.slug === moduleSlug) : undefined;

  migas.push(
    modulo
      ? { label: suite.name, to: `/suites/${projectId}/${suite.slug}` }
      : { label: suite.name },
  );
  if (modulo) migas.push({ label: modulo.name });

  return migas;
}
