import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../shell/AppShell.js';
import { EnvironmentsMenu } from './EnvironmentsMenu.js';
import { PipelinesMenu } from './PipelinesMenu.js';
import { FloatingChat } from '../Chat/FloatingChat.js';
import { ModuleTools } from '../shell/ModuleTools.js';
import { HerramientaCorridaProvider } from './herramienta-corrida.js';
import { WorkspaceAnchorProvider, useShellAnchorRef } from './workspace-anchor.js';
import { MedidaDeSuperficieProvider } from './medida-de-superficie.js';
import { ActiveProjectProvider, useActiveProject } from '../../hooks/useActiveProject.js';
import { useAuth } from '../../hooks/useAuth.js';
import { rutaDeAterrizaje, superficiesDe } from '../../lib/superficies-del-riel.js';
import { migasDeLaRuta } from '../../lib/migas.js';
import type { CatalogSuite } from '../../lib/catalog-api.js';

/**
 * El shell de la app, sobre el chasis del template SpaceMyWork.
 *
 * Reemplaza a `AppShellTemplate` (el shell portado de Figma): la demo adopta el
 * sistema del template entero, y dos chasis conviviendo significaría dos
 * respuestas distintas a dónde va cada cosa.
 *
 * Acá sólo se resuelve QUÉ va en cada slot; la estructura vive en AppShell,
 * donde el árbol es el contrato con el CSS.
 */

const TITULOS: Record<string, { titulo: string; sub?: string }> = {
  '': { titulo: 'Dashboard', sub: 'El estado de la flota' },
  chat: { titulo: 'Chat', sub: 'Conversaciones por proyecto' },
  plans: { titulo: 'Planes', sub: 'Lo que se ejecuta por pasos' },
  environments: { titulo: 'Environments', sub: 'Lo que cada proyecto necesita corriendo' },
  workspaces: { titulo: 'Workspaces', sub: 'Espacios de trabajo y sus cambios' },
  catalogo: { titulo: 'Catálogo', sub: 'Suites y módulos' },
  puertos: { titulo: 'Puertos', sub: 'Qué bloque tiene cada organización' },
  users: { titulo: 'Usuarios', sub: 'Quién entra y con qué permisos' },
};

/**
 * QUÉ DICE EL TÍTULO DEL TOPBAR: dónde estás.
 *
 * Para las superficies fijas sale de `TITULOS`. Para un módulo sale del módulo
 * —su nombre y su descripción—, y ahí está el punto: antes caía al fallback y
 * decía «Jarvis», que no es una ubicación sino el nombre del producto. El
 * encabezado es el único lugar de la pantalla que nombra lo que estás mirando,
 * porque el área de trabajo es la superficie del módulo y no lleva títulos
 * propios.
 *
 * Se deriva de la ruta y de las suites del proyecto, igual que las migas y por
 * la misma razón: la ubicación ya está en la URL, y un segundo lugar donde
 * decirla es un segundo lugar que se desincroniza.
 */
function seccionDeLaRuta(entrada: {
  pathname: string;
  suites: CatalogSuite[];
  projectId: string | null;
}): { titulo: string; sub?: string } {
  const { pathname, suites, projectId } = entrada;
  const [, segmento, , suiteSlug, moduleSlug] = pathname.split('/');

  if (segmento === 'suites' && projectId) {
    const suite = suites.find((s) => s.slug === suiteSlug);
    if (!suite) return { titulo: 'Suite' };
    /* Sin módulo en la URL manda la suite. `SuitePage` cae al primer módulo en
       ese caso, pero recién después de resolverlo: hasta entonces la suite es
       lo único que se sabe, y decir el nombre de un módulo que todavía no se
       eligió sería adelantarse. */
    const modulo = moduleSlug ? suite.modules.find((m) => m.slug === moduleSlug) : undefined;
    const elegido = modulo ?? suite.modules[0];
    return elegido
      ? { titulo: elegido.name, sub: elegido.description ?? undefined }
      : { titulo: suite.name, sub: suite.description ?? undefined };
  }

  return TITULOS[segmento ?? ''] ?? { titulo: 'Jarvis' };
}

export function AppLayout(): React.ReactElement {
  return (
    // El provider envuelve al shell porque el anchor por defecto ES el área de
    // contenido del shell: quien lo registra tiene que estar adentro.
    //
    // El del proyecto activo va MÁS AFUERA todavía, y en el layout y no en cada
    // pantalla: el sidebar y el chat flotante lo leen los dos, y montado más
    // adentro cada navegación lo remontaría — o sea que volvería a pedir la
    // lista y el menú parpadearía en cada pantalla.
    <ActiveProjectProvider>
      {/* El canal de la última corrida envuelve al shell porque sus dos puntas
          están adentro y no se ven entre sí: la caja de herramientas de la
          columna derecha corre, y el área de trabajo de la página muestra. */}
      <HerramientaCorridaProvider>
        <WorkspaceAnchorProvider>
          {/* La cuenta del segundo renglón del título: la publica la superficie
              y la dibuja el topbar, que son dos componentes distintos. */}
          <MedidaDeSuperficieProvider>
            <ShellConAnchor />
          </MedidaDeSuperficieProvider>
        </WorkspaceAnchorProvider>
      </HerramientaCorridaProvider>
    </ActiveProjectProvider>
  );
}

/**
 * EL ATERRIZAJE DEL CLIENTE.
 *
 * `/` es el Dashboard, que es del operador: sacarlo del riel no alcanza si la
 * ruta raíz —a la que se llega al loguearse y al apretar «volver al inicio»—
 * lo sigue mostrando. Un cliente se manda a su primera superficie.
 *
 * Con `replace`: el Dashboard no tiene que quedar en el historial de alguien
 * que no debería verlo, o el botón «atrás» lo trae de vuelta.
 *
 * Y sólo cuando HAY a dónde ir. Un cliente sin suites habilitadas se queda
 * donde está: mandarlo a otra pantalla que tampoco le corresponde sería cambiar
 * un problema por otro. Eso deja un pendiente real —la pantalla de «todavía no
 * tenés nada habilitado» no existe— y se ve así en vez de taparse.
 */
function useAterrizaje(): void {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId, suites } = useActiveProject();

  const esOperador = user?.account_type === 'operator';
  const destino = rutaDeAterrizaje(superficiesDe({ suites, projectId, esOperador }));

  useEffect(() => {
    if (esOperador || pathname !== '/' || !destino || destino === '/') return;
    navigate(destino, { replace: true });
  }, [esOperador, pathname, destino, navigate]);
}

function ShellConAnchor(): React.ReactElement {
  const contentRef = useShellAnchorRef();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { projectId, suites } = useActiveProject();
  useAterrizaje();

  /* Se derivan de la RUTA y de las suites del proyecto, no de un estado propio:
     la ubicación ya está en la URL, y un segundo lugar donde decirla es un
     segundo lugar que se desincroniza del riel. */
  const migas = migasDeLaRuta({ pathname, suites, projectId });
  const { titulo, sub } = seccionDeLaRuta({ pathname, suites, projectId });

  return (
    <AppShell
      titulo={titulo}
      sub={sub}
      migas={migas}
      onIrA={(to) => navigate(to)}
      acciones={
        <>
          <EnvironmentsMenu />
          <PipelinesMenu />
        </>
      }
      contentRef={contentRef}
      chat={<FloatingChat />}
      /* La caja de herramientas de la superficie: las herramientas del módulo
         abierto. Devuelve `null` cuando no hay módulo, y la columna se encarga
         de decirlo — el hueco lo maneja quien sabe qué pestaña está activa. */
      herramientas={<ModuleTools />}
    >
      <Outlet />
    </AppShell>
  );
}
