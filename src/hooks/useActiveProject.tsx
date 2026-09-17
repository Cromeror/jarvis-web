import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listProjects, type ProjectSummary } from '../lib/projects-api.js';
import { fetchNavigation, type CatalogPackage } from '../lib/catalog-api.js';
import {
  guardarProyecto,
  leerProyectoGuardado,
  projectIdDeLaUrl,
  resolverProyectoActivo,
  rutaAlCambiarDeProyecto,
} from '../lib/proyecto-activo.js';
import { useAuth } from './useAuth.js';

export { projectIdDeLaUrl } from '../lib/proyecto-activo.js';

/**
 * EL PROYECTO EN EL QUE SE TRABAJA, como estado de la app y no como dato de la
 * ruta.
 *
 * Antes salía sólo de la URL, con un fallback al único proyecto accesible. Eso
 * alcanzaba mientras el proyecto decidía únicamente QUÉ CONTENIDO se mira; deja
 * de alcanzar ahora que también decide QUÉ MENÚ HAY —los paquetes del proyecto
 * son entradas del sidebar—, porque entonces el menú se rearmaba en cada
 * navegación a una ruta sin proyecto y volvía a aparecer cuando la ruta lo
 * traía. El menú no puede parpadear con la pantalla.
 *
 * LA LISTA SE PIDE UNA VEZ POR SESIÓN, acá. Antes el módulo tenía su propio
 * cache justamente porque dos consumidores la pedían en cada navegación; con un
 * provider el cache sobra: el estado ES el cache, y además se comparte con
 * quien necesite la lista entera (el selector).
 */

type Estado = {
  /** `null` = no hay proyecto elegido y hay más de uno para elegir. */
  projectId: string | null;
  proyectos: ProjectSummary[];
  /** La lista todavía no llegó: no es lo mismo que no tener proyectos. */
  cargando: boolean;
  /**
   * Los paquetes habilitados en el proyecto activo.
   *
   * Viven acá y no en el sidebar porque tienen DOS lectores que no se ven entre
   * sí: el riel, que dibuja el menú, y la caja de herramientas de la columna
   * derecha, que muestra las herramientas del módulo abierto. Pedirlos en cada
   * uno serían dos llamadas por proyecto para la misma respuesta.
   */
  paquetes: CatalogPackage[];
  /** La elección es una decisión del usuario y no un trámite: hay más de uno, o todavía no hay ninguno elegido. */
  hayQueElegir: boolean;
  elegir: (projectId: string) => void;
};

const Ctx = createContext<Estado | null>(null);

export function ActiveProjectProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [proyectos, setProyectos] = useState<ProjectSummary[] | null>(null);
  const [paquetes, setPaquetes] = useState<CatalogPackage[]>([]);
  const [guardado, setGuardado] = useState<string | null>(() => leerProyectoGuardado());

  // La lista se recarga si cambia el usuario: los proyectos accesibles son
  // suyos, y quedarse con los del anterior mostraría un menú ajeno.
  useEffect(() => {
    let vivo = true;
    setProyectos(null);
    void listProjects()
      .then((p) => {
        if (vivo) setProyectos(p);
      })
      .catch(() => {
        // Sin lista no se puede elegir, pero lo que la URL diga sigue valiendo:
        // un fallo de red no puede dejar al usuario sin la pantalla que pidió.
        if (vivo) setProyectos([]);
      });
    return () => {
      vivo = false;
    };
  }, [user?.id]);

  const deLaUrl = projectIdDeLaUrl(pathname);
  const accesibles = useMemo(() => proyectos?.map((p) => p.id) ?? null, [proyectos]);
  /* Sólo el cliente trabaja EN un proyecto; el operador los administra todos
     (ver `resolverProyectoActivo`). Sin usuario resuelto todavía no se
     autoelige: el default cierra, no abre. */
  const projectId = resolverProyectoActivo({
    deLaUrl,
    guardado,
    accesibles,
    autoElegirUnico: user?.account_type === 'member',
  });

  // Lo resuelto se persiste, venga de donde venga: entrar por un link a
  // `/chat/:id` es elegir ese proyecto, y al volver al Dashboard —que no lleva
  // proyecto en la ruta— tiene que seguir siendo el mismo.
  useEffect(() => {
    if (projectId && projectId !== guardado) {
      guardarProyecto(projectId);
      setGuardado(projectId);
    }
  }, [projectId, guardado]);

  /* Un 403 o un proyecto sin paquetes dejan la lista vacía: un fallo de carga
     no se cuenta en el menú. Al operador ni se le piden — su riel no los dibuja
     (ver `superficiesDe`), así que sería una llamada por proyecto para tirar la
     respuesta. */
  const esOperador = user?.account_type === 'operator';
  useEffect(() => {
    if (!projectId || esOperador) {
      setPaquetes([]);
      return;
    }
    let vivo = true;
    void fetchNavigation(projectId)
      .then((p) => {
        if (vivo) setPaquetes(p);
      })
      .catch(() => {
        if (vivo) setPaquetes([]);
      });
    return () => {
      vivo = false;
    };
  }, [projectId, esOperador]);

  const elegir = useCallback(
    (id: string) => {
      guardarProyecto(id);
      setGuardado(id);
      const destino = rutaAlCambiarDeProyecto(pathname, id);
      if (destino !== pathname) navigate(destino);
    },
    [pathname, navigate],
  );

  const valor = useMemo<Estado>(
    () => ({
      projectId,
      proyectos: proyectos ?? [],
      cargando: proyectos === null,
      paquetes,
      /* Con un proyecto ya elegido y ningún otro adonde ir, no hay decisión que
         tomar. Pero un operador con un solo proyecto SÍ tiene que poder
         elegirlo: no se le autoeligió, así que sin esto quedaría sin forma de
         entrar a ninguno. */
      hayQueElegir: (proyectos?.length ?? 0) > 1 || (projectId === null && (proyectos?.length ?? 0) > 0),
      elegir,
    }),
    [projectId, proyectos, paquetes, elegir],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useActiveProject(): Estado {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fuera del provider no se inventa un proyecto: un componente que decide
    // qué mostrar con un id adivinado es peor que uno que no muestra nada.
    return {
      projectId: null,
      proyectos: [],
      cargando: false,
      paquetes: [],
      hayQueElegir: false,
      elegir: () => {},
    };
  }
  return ctx;
}

/** El id solo — la forma en que lo consume casi todo. */
export function useActiveProjectId(): string | null {
  return useActiveProject().projectId;
}
