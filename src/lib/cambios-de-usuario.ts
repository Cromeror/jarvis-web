/**
 * QUÉ CAMBIA AL GUARDAR UN USUARIO: la diferencia entre cómo estaba el
 * formulario al abrirse y cómo está ahora.
 *
 * Sirve para dos cosas del modal de usuario: «Guardar» se habilita sólo si hay
 * al menos un cambio, y antes de guardar se muestra este resumen para
 * confirmar. Lo que se QUITA se separa de lo que se agrega (`hayQuitas`)
 * porque es lo que no se ve venir: sacar un rol es sacarle a alguien acceso a
 * algo que usaba.
 *
 * Sin React, para poder probarlo.
 */

export interface FormDeUsuario {
  username: string;
  password: string;
  account_type: 'operator' | 'client';
  organization_id: string;
  organization_role_id: string;
  project_roles: Array<{ project_id: string; role_id: string }>;
}

export interface CambioDeProyecto {
  project_id: string;
  /** `agregado`: no lo tenía. `quitado`: lo tenía y ya no. `modificado`: cambiaron sus roles. */
  tipo: 'agregado' | 'quitado' | 'modificado';
  rolesAgregados: string[];
  rolesQuitados: string[];
}

export interface ResumenDeCambios {
  cuenta: { de: FormDeUsuario['account_type']; a: FormDeUsuario['account_type'] } | null;
  clave: boolean;
  /** La organización elegida para alguien que no tenía: id de la organización y del rol. */
  organizacion: { id: string; rol: string } | null;
  proyectos: CambioDeProyecto[];
  /** Si algo se saca: un proyecto entero, o un rol de uno. */
  hayQuitas: boolean;
  vacio: boolean;
}

function rolesPorProyecto(f: FormDeUsuario): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const a of f.project_roles) {
    if (!m.has(a.project_id)) m.set(a.project_id, new Set());
    m.get(a.project_id)!.add(a.role_id);
  }
  return m;
}

export function cambiosDeUsuario(antes: FormDeUsuario, despues: FormDeUsuario): ResumenDeCambios {
  const a = rolesPorProyecto(antes);
  // Un operador no lleva proyectos: lo que tuviera tildado no se guarda, así que
  // no cuenta como cambio.
  const d = despues.account_type === 'client' ? rolesPorProyecto(despues) : new Map<string, Set<string>>();

  const proyectos: CambioDeProyecto[] = [];
  for (const id of new Set([...a.keys(), ...d.keys()])) {
    const de = a.get(id) ?? new Set<string>();
    const ahora = d.get(id) ?? new Set<string>();
    const rolesAgregados = [...ahora].filter((r) => !de.has(r));
    const rolesQuitados = [...de].filter((r) => !ahora.has(r));
    if (rolesAgregados.length === 0 && rolesQuitados.length === 0) continue;
    const tipo = de.size === 0 ? 'agregado' : ahora.size === 0 ? 'quitado' : 'modificado';
    proyectos.push({ project_id: id, tipo, rolesAgregados, rolesQuitados });
  }

  const cuenta = antes.account_type !== despues.account_type ? { de: antes.account_type, a: despues.account_type } : null;
  const clave = despues.password.trim() !== '';
  const organizacion =
    despues.account_type === 'client' && despues.organization_id && despues.organization_id !== antes.organization_id
      ? { id: despues.organization_id, rol: despues.organization_role_id }
      : null;
  const usuarioCambia = antes.username.trim() !== despues.username.trim();

  return {
    cuenta,
    clave,
    organizacion,
    proyectos,
    hayQuitas: proyectos.some((p) => p.rolesQuitados.length > 0),
    vacio: !cuenta && !clave && !organizacion && !usuarioCambia && proyectos.length === 0,
  };
}
