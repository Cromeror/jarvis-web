import { createContext, useContext } from 'react';

/**
 * EL TERCER ESTADO DE LA TARJETA DEL CHAT: plegada a pastilla.
 *
 * No es cerrar. El chat es del shell y nunca se va (decisión 8 del template);
 * minimizar lo pliega a su propia barra, que se queda donde estaba. El CSS ya
 * lo resuelve entero con `.sw-flota[data-min="true"]` (`chat.css`): acá sólo
 * viaja quién manda el atributo.
 *
 * Y viaja por contexto porque las dos mitades están separadas: el atributo va
 * en `.sw-flota`, que pinta `AppShell`, y el botón va en la barra, que pinta
 * `FloatingChat` —ahí es donde está la conversación—. Subir el estado al shell
 * y bajar el control por contexto es lo que evita que el shell tenga que saber
 * de sesiones, o que el chat tenga que escribirle atributos a su padre por DOM.
 */
export interface TarjetaDelChat {
  minimizada: boolean;
  alternar: () => void;
}

const TarjetaDelChatContext = createContext<TarjetaDelChat | null>(null);

export const TarjetaDelChatProvider = TarjetaDelChatContext.Provider;

/**
 * Fuera de la tarjeta devuelve `null`: el chat también se renderiza en la
 * pantalla completa (`/chat`), donde no hay nada que plegar. Tirar ahí sería
 * convertir una ausencia legítima en un error.
 */
export function useTarjetaDelChat(): TarjetaDelChat | null {
  return useContext(TarjetaDelChatContext);
}

/** Dónde se recuerda la elección. Ver `useMinimizable` en `AppShell`. */
export const MIN_KEY = 'sw.chat.minimizado';
