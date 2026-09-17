import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';

/** Secciones cuya segunda parte de la ruta ES un proyecto. */
const CON_PROYECTO = ['chat', 'plans', 'environments', 'workspaces', 'paquetes'];

export function projectIdDeLaUrl(pathname: string): string | null {
  const [, seccion, posibleProyecto] = pathname.split('/');
  if (!seccion || !CON_PROYECTO.includes(seccion)) return null;
  return posibleProyecto || null;
}

/**
 * Cache a nivel módulo del proyecto único.
 *
 * La pregunta "¿cuántos proyectos tengo?" no cambia mientras dura la sesión, y
 * la hacen dos consumidores (el sidebar y el chat flotante) en cada navegación.
 * Sin esto serían dos llamadas por pantalla para responder siempre lo mismo.
 */
let unicoProyecto: string | null | undefined;
let pedido: Promise<void> | null = null;

async function resolverUnicoProyecto(): Promise<void> {
  if (unicoProyecto !== undefined) return;
  pedido ??= listProjects()
    .then((proyectos) => {
      // Exactamente uno: ahí no hay nada que elegir. Con varios se devuelve
      // `null` a propósito — adivinar cuál quiso el usuario es peor que no
      // mostrar nada, porque lo que se muestra son SUS herramientas y su
      // contenido.
      unicoProyecto = proyectos.length === 1 ? (proyectos[0]?.id ?? null) : null;
    })
    .catch(() => {
      unicoProyecto = null;
    });
  await pedido;
}

/**
 * De qué proyecto es lo que se está mirando.
 *
 * Sale de la URL, que es donde vive hoy el proyecto activo (`/chat/:projectId`,
 * `/paquetes/:projectId/...`): no hay un contexto global de proyecto en la SPA.
 *
 * Y cuando la ruta no lo dice —el Dashboard, por ejemplo— cae al ÚNICO proyecto
 * accesible, si hay uno solo. Sin ese fallback, un usuario cliente entra a la
 * app y ve el menú vacío hasta que navega a una ruta con proyecto: el caso más
 * común de todos terminaba siendo el que peor funcionaba. Con varios proyectos
 * sigue devolviendo `null`, porque ahí elegir por él sí sería adivinar.
 */
export function useActiveProjectId(): string | null {
  const { pathname } = useLocation();
  const deLaUrl = projectIdDeLaUrl(pathname);
  const [fallback, setFallback] = useState<string | null>(unicoProyecto ?? null);

  useEffect(() => {
    if (deLaUrl) return;
    let cancelado = false;
    void resolverUnicoProyecto().then(() => {
      if (!cancelado) setFallback(unicoProyecto ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [deLaUrl]);

  return deLaUrl ?? fallback;
}
