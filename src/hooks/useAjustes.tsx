import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AjustesModal } from '../components/ajustes/AjustesModal.js';

/**
 * Quién abre el modal de Ajustes. Hay dos puertas —el menú del avatar y el pie
 * de la navegación— y un solo modal: el proveedor lo dibuja una vez y cada
 * puerta sólo llama a `abrir()`.
 */
const AjustesContext = createContext<{ abrir: () => void }>({ abrir: () => undefined });

export function AjustesProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [abierto, setAbierto] = useState(false);
  const abrir = useCallback(() => setAbierto(true), []);
  const valor = useMemo(() => ({ abrir }), [abrir]);
  return (
    <AjustesContext.Provider value={valor}>
      {children}
      <AjustesModal abierto={abierto} onCerrar={() => setAbierto(false)} />
    </AjustesContext.Provider>
  );
}

export function useAjustes(): { abrir: () => void } {
  return useContext(AjustesContext);
}
