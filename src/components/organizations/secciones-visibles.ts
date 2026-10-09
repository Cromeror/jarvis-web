/**
 * Qué secciones de «Mi organización» se dibujan. Sin React, para poder
 * probarlo: la regla es la parte que importa y la que se rompe sin hacer ruido.
 */

export interface SeccionDeOrganizacion<N = unknown> {
  /** Basta con uno: cada sección apaga adentro lo que su permiso no cubre. */
  permisos: readonly string[];
  render: (organizationId: string, permisos: readonly string[]) => N;
}

/**
 * Las de los módulos que la organización TIENE y que quien mira PUEDE usar
 * (al menos uno de sus permisos). Los dos ejes de siempre: la suite decide
 * visibilidad, el rol autoridad. En el orden en que vienen los módulos.
 *
 * Una `key` sin sección en este bundle se ignora: es un módulo más nuevo que el
 * front.
 */
export function seccionesVisibles<S extends { permisos: readonly string[] }>(
  registro: Readonly<Record<string, S>>,
  modulos: ReadonlyArray<{ key: string | null; name: string }>,
  permisos: readonly string[],
): Array<{ key: string; nombre: string; seccion: S }> {
  return modulos.flatMap((m) => {
    const seccion = m.key ? registro[m.key] : undefined;
    if (!m.key || !seccion) return [];
    if (!seccion.permisos.some((p) => permisos.includes(p))) return [];
    return [{ key: m.key, nombre: m.name, seccion }];
  });
}
