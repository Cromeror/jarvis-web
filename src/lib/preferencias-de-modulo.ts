/**
 * Cómo le gusta a esta persona ver un módulo — qué columnas, qué orden, qué
 * filtro deja puesto.
 *
 * Es transversal: cualquier módulo lo usa con la forma que quiera. La
 * plataforma no sabe qué guarda —no puede saber qué es una columna de
 * causación— y lo único que impone es el tamaño, del lado del servidor.
 *
 * ## Lo que esto NO es
 *
 * No es el almacenamiento del módulo. Todo lo que viva acá tiene que poder
 * faltar: si no hay nada guardado, el módulo usa sus defaults y no pasa nada.
 * Por eso las escrituras son **fail-soft** —no se le avisa al usuario que no se
 * pudo guardar su preferencia de columnas, se sigue— y por eso el hook nunca
 * bloquea el render esperando la lectura.
 */

export interface PreferenciasDeModulo {
  [clave: string]: unknown;
}

export async function leerPreferencias(moduleKey: string): Promise<PreferenciasDeModulo> {
  try {
    const res = await fetch(`/api/modules/${encodeURIComponent(moduleKey)}/preferences`);
    if (!res.ok) return {};
    const body = (await res.json()) as { prefs?: PreferenciasDeModulo };
    return body.prefs ?? {};
  } catch {
    // Sin preferencias el módulo se ve con sus defaults, que es un estado
    // perfectamente usable. Romper la pantalla por esto sería peor.
    return {};
  }
}

/** Reemplazo total: el módulo manda su estado completo, no un diff. */
export async function guardarPreferencias(moduleKey: string, prefs: PreferenciasDeModulo): Promise<void> {
  try {
    await fetch(`/api/modules/${encodeURIComponent(moduleKey)}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs }),
    });
  } catch {
    // Ídem: que no se haya podido recordar una preferencia no es algo que
    // merezca interrumpir a nadie.
  }
}
