import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * QUÉ TIENE SELECCIONADO EL USUARIO EN LA SUPERFICIE, para que el chat lo sepa.
 *
 * Mismo problema que `medida-de-superficie` y misma forma: quien SABE (la vista
 * del módulo, que tiene las filas marcadas) y quien lo USA (el chat flotante,
 * que lo dibuja el shell) dejaron de ser el mismo componente.
 *
 * ## Por qué un canal y no la URL
 *
 * La ubicación se deriva del pathname, así que no necesita canal. Una selección
 * no cabe ahí: son ids que cambian con cada clic, y meterlos en la URL llenaría
 * el historial del browser de estados intermedios que nadie quiere revisitar.
 *
 * ## Deliberadamente chico
 *
 * Ids y una etiqueta corta, no las filas. Esto viaja al prompt del chat: mandar
 * el contenido de lo seleccionado sería pagar por turno lo que el modelo puede
 * ir a buscar con una tool si lo necesita — la misma economía que hace que el
 * contrato de un BC se lea con `bc_get` en vez de inyectarse.
 *
 * Se limpia al desmontar la superficie: una selección colgada de la pantalla
 * anterior le haría creer al chat que el usuario señaló algo que ya no mira.
 */

export interface SeleccionDeSuperficie {
  /** Qué clase de cosa es, para que el chat sepa de qué habla (`documento`). */
  kind: string;
  /** Los ids marcados. Vacío = nada seleccionado, y entonces no se publica. */
  ids: string[];
  /**
   * Cómo nombrarlos en una línea, cuando son pocos (`factura-12.pdf`).
   *
   * Opcional y corta: sirve para que el usuario pueda decir «causá éste» sin
   * pegar un id. Con muchos seleccionados no se manda — la lista completa la
   * trae el modelo con una tool.
   */
  label?: string;
}

const Ctx = createContext<{
  seleccion: SeleccionDeSuperficie | null;
  setSeleccion: (s: SeleccionDeSuperficie | null) => void;
}>({ seleccion: null, setSeleccion: () => undefined });

export function SeleccionDeSuperficieProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [seleccion, setSeleccion] = useState<SeleccionDeSuperficie | null>(null);
  const valor = useMemo(() => ({ seleccion, setSeleccion }), [seleccion]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSeleccionDeSuperficie(): {
  seleccion: SeleccionDeSuperficie | null;
  setSeleccion: (s: SeleccionDeSuperficie | null) => void;
} {
  return useContext(Ctx);
}

/** Para la superficie que publica lo que tiene marcado. La limpia al desmontarse. */
export function usePublicarSeleccion(seleccion: SeleccionDeSuperficie | null): void {
  const { setSeleccion } = useSeleccionDeSuperficie();
  React.useEffect(() => {
    setSeleccion(seleccion && seleccion.ids.length > 0 ? seleccion : null);
    return () => setSeleccion(null);
  }, [seleccion, setSeleccion]);
}
