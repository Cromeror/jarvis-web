import React, { createContext, useContext, useMemo, useState } from 'react';
import type { CatalogModuleTool } from '../../lib/catalog-api.js';

/**
 * LO ÚLTIMO QUE DEVOLVIÓ UNA HERRAMIENTA.
 *
 * Existe porque quien la CORRE y quien MUESTRA el resultado dejaron de ser el
 * mismo componente: las herramientas se mudaron al panel «Herramientas» de la
 * columna derecha —que lo dibuja el shell— y el resultado sigue yendo al área
 * de trabajo, que es de la página. Un JSON no entra en una columna de 350px, y
 * además no es una opción: es el resultado del trabajo.
 *
 * Es un canal deliberadamente chico: UNA corrida, la última. No es un historial
 * —para eso está el resultado en la propia pantalla del módulo— y no persiste:
 * cambiar de módulo lo limpia, porque un resultado viejo colgado abajo de otro
 * módulo se lee como si fuera de ése.
 */

export interface HerramientaCorrida {
  /** El tipo viene de la API, donde esto todavía se llama `moduleTool`. */
  herramienta: CatalogModuleTool;
  output?: unknown;
  error?: string;
}

interface Valor {
  corrida: HerramientaCorrida | null;
  setCorrida: (c: HerramientaCorrida | null) => void;
}

const Ctx = createContext<Valor | null>(null);

export function HerramientaCorridaProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [corrida, setCorrida] = useState<HerramientaCorrida | null>(null);
  const valor = useMemo<Valor>(() => ({ corrida, setCorrida }), [corrida]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useHerramientaCorrida(): Valor {
  // Fuera del provider el canal es mudo en vez de romper: una pantalla suelta
  // (el editor, el mapa) no tiene caja de herramientas de la que recibir nada.
  return useContext(Ctx) ?? { corrida: null, setCorrida: () => {} };
}
