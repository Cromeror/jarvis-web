import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface WorkspaceAnchorValue {
  /** Dónde se dibuja lo que flota sobre el área de trabajo. `null` = todavía no montó nadie. */
  anchor: HTMLElement | null;
  /** Lo registra el shell: el área de contenido, que es el default. */
  setShellAnchor: (el: HTMLElement | null) => void;
  /** Lo registra una página con rail propio: su columna de trabajo, que es MÁS chica que el contenido. */
  setPageAnchor: (el: HTMLElement | null) => void;
}

const WorkspaceAnchorContext = createContext<WorkspaceAnchorValue | null>(null);

/**
 * Dónde flota lo que acompaña al trabajo (hoy: el chat flotante).
 *
 * El problema que resuelve: `fixed` ancla al viewport, así que el chat quedaba
 * ENCIMA del rail derecho de una página que lo tuviera. Y no alcanza con
 * anclarlo al contenido del shell, porque el rail vive dentro de la página: hay
 * que anclarlo a la columna de trabajo, la que se ensancha cuando el rail se
 * colapsa. Ahí el chat se mueve solo, sin saber nada del rail.
 *
 * Dos niveles con precedencia y no uno: el shell registra el default —que sirve
 * para las pantallas sin rail, que son la mayoría— y una página con rail lo
 * pisa mientras está montada. Con un solo nivel, cada página tendría que
 * acordarse de registrar el suyo, y la que se olvide deja el chat sin lugar.
 */
export function WorkspaceAnchorProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [shellAnchor, setShellAnchor] = useState<HTMLElement | null>(null);
  const [pageAnchor, setPageAnchor] = useState<HTMLElement | null>(null);

  const value = useMemo<WorkspaceAnchorValue>(
    () => ({ anchor: pageAnchor ?? shellAnchor, setShellAnchor, setPageAnchor }),
    [pageAnchor, shellAnchor],
  );

  return <WorkspaceAnchorContext.Provider value={value}>{children}</WorkspaceAnchorContext.Provider>;
}

/** El nodo sobre el que flotar. `null` fuera del provider — el consumidor decide el fallback. */
export function useWorkspaceAnchor(): HTMLElement | null {
  return useContext(WorkspaceAnchorContext)?.anchor ?? null;
}

/**
 * Ref callback para que el shell registre su área de contenido.
 *
 * El nodo necesita `position: relative`: lo que flota se posiciona con
 * `absolute` contra él.
 */
export function useShellAnchorRef(): (el: HTMLElement | null) => void {
  const ctx = useContext(WorkspaceAnchorContext);
  return useCallback((el: HTMLElement | null) => ctx?.setShellAnchor(el), [ctx]);
}

/**
 * Ref callback para una página con rail: registra su columna de trabajo y la
 * libera al desmontarse (React llama al callback con `null`), para que el chat
 * vuelva al área completa en la pantalla siguiente.
 */
export function usePageAnchorRef(): (el: HTMLElement | null) => void {
  const ctx = useContext(WorkspaceAnchorContext);
  return useCallback((el: HTMLElement | null) => ctx?.setPageAnchor(el), [ctx]);
}
