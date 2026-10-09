/**
 * Cómo se mira la lista de usuarios del operador: POR ORGANIZACIÓN, más una
 * lista «Sin asignar». Sin React, para poder probarlo.
 *
 * Revisar usuarios se piensa por organización; la lista global, revuelta, no
 * contestaba nada. Pero en una vista sólo por organización desaparecerían justo
 * los que hay que revisar —alguien los creó y nadie los metió en una—, y para
 * eso está «Sin asignar». Diseño en `docs/buckets-de-modulos.md` del workspace.
 */

export interface UsuarioParaFiltrar {
  account_type: 'operator' | 'client';
  organization: { organization_id: string } | null;
}

/**
 * Cuántos clientes esperan organización: el número del botón «N sin asignar».
 *
 * Los operadores aparecen en la lista pero NO cuentan: no esperan nada —operan
 * la instalación, por encima de las organizaciones—, y con ellos adentro el
 * contador nunca llegaría a cero.
 */
export function pendientesDeAsignar(usuarios: readonly UsuarioParaFiltrar[]): number {
  return usuarios.filter((u) => u.account_type === 'client' && !u.organization).length;
}

/**
 * Las filas que se ven: «Sin asignar» (clientes sin organización, y los
 * operadores, marcados como tales) o los miembros de la organización elegida.
 * Sin organización elegida y sin «Sin asignar», ninguna: la tabla no vuelve a
 * mostrar a todos revueltos.
 */
export function filasDeUsuarios<U extends UsuarioParaFiltrar>(
  usuarios: readonly U[],
  vista: { sinAsignar: boolean; organizationId: string | null },
): U[] {
  if (vista.sinAsignar) return usuarios.filter((u) => u.account_type === 'operator' || !u.organization);
  if (!vista.organizationId) return [];
  return usuarios.filter((u) => u.organization?.organization_id === vista.organizationId);
}
