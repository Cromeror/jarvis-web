import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../Icon.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import { useAuth } from '../../hooks/useAuth.js';
import { moduloDeLaRuta, superficiesDe } from '../../lib/superficies-del-riel.js';
import { runModuleTool } from '../../lib/catalog-api.js';
import { useHerramientaCorrida } from '../layout/herramienta-corrida.js';

/**
 * LA CAJA DE HERRAMIENTAS DEL MÓDULO — lo que se puede correr sobre lo que se
 * está mirando, en la pestaña «Herramientas» de la columna derecha.
 *
 * Reemplaza a `UtilitiesRail`, que hacía esto mismo pero en un rail PROPIO de
 * `PackagePage`. Eran dos cajas de herramientas: la de la superficie, que el
 * shell ya tenía y nadie llenaba —siempre decía «esta superficie no trae caja
 * de herramientas»— y una segunda adentro de una sola pantalla. La columna
 * derecha es LA caja de herramientas (decisión 43 del template), así que las
 * herramientas del módulo son exactamente su contenido.
 *
 * EL RESULTADO NO SE MUESTRA ACÁ. Va al área de trabajo por
 * `useHerramientaCorrida`, por lo mismo que antes: un JSON no entra en 350px, y
 * es el resultado del trabajo, no una opción sobre él.
 *
 * Devuelve `null` cuando no hay módulo abierto, y eso es lo que hace que la
 * columna diga «esta superficie no trae caja de herramientas» en vez de mostrar
 * un panel vacío: el hueco lo maneja `SideColumn`, que es quien sabe qué
 * pestaña está activa.
 */
export function ModuleTools(): React.ReactElement | null {
  const { pathname } = useLocation();
  const { projectId, paquetes } = useActiveProject();
  const { user } = useAuth();
  const { setCorrida } = useHerramientaCorrida();
  const [corriendo, setCorriendo] = useState<string | null>(null);

  const superficies = superficiesDe({
    paquetes,
    projectId,
    esOperador: user?.account_type === 'operator',
  });
  const enfoque = moduloDeLaRuta(pathname, superficies);
  const moduloId = enfoque?.modulo.id ?? null;

  /* Cambiar de módulo limpia el resultado: colgado abajo de otro módulo se lee
     como si fuera de ése. */
  useEffect(() => {
    setCorrida(null);
  }, [moduloId, setCorrida]);

  if (!enfoque || !projectId) return null;
  const { modulo, paquete } = enfoque;

  async function ejecutar(herramienta: (typeof modulo.herramientas)[number]): Promise<void> {
    setCorriendo(herramienta.id);
    try {
      // Sin input: las herramientas que necesitan datos los piden desde la
      // vista del módulo, que es la que sabe qué datos son. Si una los exige y
      // llega vacía, el error de la propia tool dice qué falta — mejor
      // explicación que cualquiera que pudiéramos inventar acá.
      const output = await runModuleTool(projectId as string, herramienta.id, {});
      setCorrida({ herramienta: herramienta.cruda, output });
    } catch (err) {
      setCorrida({
        herramienta: herramienta.cruda,
        error: err instanceof Error ? err.message : 'No se pudo ejecutar',
      });
    } finally {
      setCorriendo(null);
    }
  }

  return (
    <div className="sw-herr">
      <header className="sw-herr__cab">
        <p className="sw-herr__ruta">{paquete.label}</p>
        <h3 className="sw-herr__titulo">{modulo.name}</h3>
        {modulo.description ? <p className="sw-herr__sub">{modulo.description}</p> : null}
      </header>

      {modulo.herramientas.length > 0 ? (
        <div className="sw-herr__lista" role="list">
          {modulo.herramientas.map((h) => {
            /* SIN TOOL DETRÁS NO SE PUEDE CORRER. La herramienta se declara en
               el catálogo antes de que su tool exista, así que esto es un
               estado normal y no un error — pero un botón que siempre falla
               enseña que la caja no funciona. Se muestra deshabilitado y con el
               motivo a la vista. */
            const sinTool = !h.toolName;
            const activa = corriendo === h.id;
            return (
              <button
                key={h.id}
                type="button"
                className="sw-herr__item"
                role="listitem"
                disabled={sinTool || corriendo !== null}
                title={sinTool ? 'Todavía no tiene una tool que la respalde' : h.name}
                onClick={() => void ejecutar(h)}
              >
                <span className="sw-herr__ico" aria-hidden="true">
                  <Icon name={activa ? 'cargando' : 'wrench'} />
                </span>
                <span className="sw-herr__txt">
                  <span className="sw-herr__nombre">{h.name}</span>
                  {h.description ? <span className="sw-herr__desc">{h.description}</span> : null}
                  {sinTool ? <span className="sw-herr__aviso">sin tool</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="sw-side-col__vacio">Este módulo todavía no declara herramientas</p>
      )}
    </div>
  );
}
