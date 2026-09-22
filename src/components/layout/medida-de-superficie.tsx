import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * LA CUENTA DEL SEGUNDO RENGLÓN DEL TOPBAR («17 accesos»).
 *
 * El template la arma en `modules.js` con `[mod.sub, val].filter(Boolean)`: la
 * DESCRIPCIÓN la declara la superficie en su contenido, y la MEDIDA la publica
 * la superficie viva cuando cambia lo que muestra (evento
 * `sw:objetos-cambiaron`).
 *
 * Acá hace falta un canal por lo mismo que `herramienta-corrida`: quien CUENTA
 * (la vista del módulo, que tiene los datos) y quien MUESTRA (el topbar, que lo
 * dibuja el shell) dejaron de ser el mismo componente.
 *
 * Es deliberadamente chico: un string, el actual. No es un historial, y se
 * limpia al cambiar de superficie — una cuenta vieja colgada bajo el título de
 * otra sección dice algo falso con total aplomo.
 */

const Ctx = createContext<{ medida: string | null; setMedida: (m: string | null) => void }>({
  medida: null,
  setMedida: () => undefined,
});

export function MedidaDeSuperficieProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [medida, setMedida] = useState<string | null>(null);
  const valor = useMemo(() => ({ medida, setMedida }), [medida]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useMedidaDeSuperficie(): { medida: string | null; setMedida: (m: string | null) => void } {
  return useContext(Ctx);
}

/**
 * Para la superficie que publica su cuenta. La limpia al desmontarse, que es
 * lo que evita que quede colgada bajo el título de la sección siguiente.
 */
export function usePublicarMedida(medida: string | null): void {
  const { setMedida } = useMedidaDeSuperficie();
  React.useEffect(() => {
    setMedida(medida);
    return () => setMedida(null);
  }, [medida, setMedida]);
}
