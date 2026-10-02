import { useCallback, useEffect, useRef, useState } from 'react';
import { guardarPreferencias, leerPreferencias, type PreferenciasDeModulo } from '../lib/preferencias-de-modulo.js';
import { difieren, escribirCache, leerCache } from '../lib/cache-de-preferencias.js';
import { useAuth } from './useAuth.js';

/**
 * Las preferencias de un módulo para la persona en sesión, **sin salto**.
 *
 * ## El problema que resuelve, y por qué no se resuelve esperando
 *
 * La pantalla pinta antes de que el servidor conteste: aparecía con los
 * defaults y se reacomodaba al llegar las preferencias. Esconder la tabla hasta
 * tenerlas cambia un salto por una demora visible en CADA carga, que es peor
 * trato.
 *
 * La salida es tener la respuesta antes de preguntar: el estado inicial sale
 * del caché local —síncrono, en el primer render— y el fetch reconcilia por
 * detrás. Con caché el primer pintado ya es el correcto; sin caché (primera vez
 * en este browser) se comporta como antes, con un solo reacomodo.
 *
 * **El servidor siempre gana.** El caché es lo que evita el salto, no la fuente:
 * si mandara él, cada browser tendría su propia verdad y abrir la cuenta en otra
 * máquina no te devolvería lo tuyo.
 *
 * ## `listas` sigue existiendo
 *
 * Con caché es `true` desde el primer render; sin caché, hasta que llegue la
 * respuesta. El módulo lo usa para no pintar con defaults algo que está por
 * cambiar — que es el salto, visto desde el otro lado.
 */
export function usePreferenciasDeModulo(moduleKey: string | null): {
  prefs: PreferenciasDeModulo;
  listas: boolean;
  guardar: (prefs: PreferenciasDeModulo) => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Inicializador perezoso: se lee en el PRIMER render, antes de pintar. En un
  // efecto sería un render tarde, o sea el salto que esto viene a sacar.
  const [prefs, setPrefs] = useState<PreferenciasDeModulo>(() => leerCache(userId, moduleKey) ?? {});
  const [listas, setListas] = useState(() => leerCache(userId, moduleKey) !== null);
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!moduleKey) {
      setListas(true);
      return;
    }
    const cacheado = leerCache(userId, moduleKey);
    if (cacheado) {
      setPrefs(cacheado);
      setListas(true);
    }
    let vivo = true;
    void leerPreferencias(moduleKey).then((delServidor) => {
      if (!vivo) return;
      // Sólo se toca el estado si CAMBIÓ: la respuesta es un objeto nuevo en
      // cada fetch, y setearla siempre produciría el re-render que el caché
      // vino a evitar.
      setPrefs((actual) => (difieren(actual, delServidor) ? delServidor : actual));
      escribirCache(userId, moduleKey, delServidor);
      setListas(true);
    });
    return () => {
      vivo = false;
    };
  }, [moduleKey, userId]);

  const guardar = useCallback(
    (siguientes: PreferenciasDeModulo) => {
      setPrefs(siguientes);
      // Al caché se escribe YA, no al confirmar el servidor: si el usuario
      // recarga en el medio, lo que ve tiene que ser lo que acaba de elegir.
      escribirCache(userId, moduleKey, siguientes);
      if (!moduleKey) return;
      // Tildar columnas es una ráfaga de clics y cada una sería un PUT. Se
      // agrupa: lo último que dejó es su preferencia.
      if (pendiente.current) clearTimeout(pendiente.current);
      pendiente.current = setTimeout(() => void guardarPreferencias(moduleKey, siguientes), 600);
    },
    [moduleKey, userId],
  );

  return { prefs, listas, guardar };
}
