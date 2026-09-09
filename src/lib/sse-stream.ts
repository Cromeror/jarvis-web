/**
 * Un stream SSE sobre `fetch`, en vez de `EventSource`.
 *
 * ## Por qué no `EventSource`
 *
 * `EventSource` no admite headers, así que la única forma de autenticarlo desde
 * un browser era mandar el JWT en la query (`?access_token=`). Eso lo deja
 * escrito en los logs de acceso del reverse proxy —Traefik registra la URL
 * completa— y en el historial del navegador. Y no es un token acotado: es el de
 * sesión, con renovación deslizante.
 *
 * Con `fetch` el token viaja en `Authorization`, que no se loguea.
 *
 * ## Lo que se gana además
 *
 * `window.fetch` está monkeypatcheado (`auth-fetch-interceptor.ts`), así que un
 * stream abierto por acá hereda GRATIS las tres cosas que el resto de las
 * llamadas ya tenían y el SSE no: el `Authorization`, la resolución del origen
 * de la API (`VITE_API_URL`) y el manejo del 401 —limpiar sesión y mandar a
 * /login—. Antes el stream era el único camino con su propia lógica de auth.
 *
 * ## Lo que hay que reponer a mano, y es el costo real
 *
 * `EventSource` reconecta solo cuando la conexión se cae (un restart de
 * `http-api`, por ejemplo). `fetch` no: si esto no reconectara, un corte de red
 * dejaría el chat mudo hasta que alguien refresque. De ahí el backoff
 * exponencial de abajo — es la parte que no se puede omitir al cambiar de
 * transporte.
 *
 * También hay que parsear el protocolo a mano: los eventos se separan con una
 * línea en blanco y el payload son las líneas `data:`. Se ignoran las líneas de
 * comentario (`:`), que es lo que se usa como heartbeat, y los campos `event:`
 * — ningún consumidor de este front usa eventos con nombre, todos leen el
 * evento default, igual que con `es.onmessage`.
 */

export interface SseHandlers {
  /** Un evento completo: el contenido de sus líneas `data:`, ya unidas. */
  onMessage: (data: string) => void;
  /** Cada (re)conexión exitosa. Los consumidores lo usan para resincronizar. */
  onOpen?: () => void;
  /** Cada caída, antes de agendar el reintento. No hace falta actuar. */
  onError?: (error: unknown) => void;
}

export interface SseStream {
  /** Corta el stream y cancela cualquier reintento pendiente. Idempotente. */
  close(): void;
}

const RECONEXION_BASE_MS = 1000;
const RECONEXION_TOPE_MS = 30_000;

/**
 * El payload de un bloque SSE, o `null` si no traía ninguna línea `data:`.
 *
 * Un bloque sin `data:` es legítimo —un comentario de heartbeat, o un `event:`
 * suelto— y no tiene que despertar al consumidor: entregarle una cadena vacía
 * lo haría intentar `JSON.parse('')` en cada latido.
 */
export function parseSseBlock(bloque: string): string | null {
  const datos = bloque
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    // El espacio opcional después de los dos puntos es parte del formato.
    .map((l) => l.slice(5).replace(/^ /, ''));
  return datos.length > 0 ? datos.join('\n') : null;
}

/** El delay del intento N, con tope. Mismo espíritu que el de EventSource. */
export function delayDeReconexion(intento: number): number {
  return Math.min(RECONEXION_BASE_MS * 2 ** intento, RECONEXION_TOPE_MS);
}

/**
 * Abre el stream y lo mantiene abierto. `path` va relativo (`/api/...`): el
 * interceptor le pone el origen y el token.
 */
export function openSseStream(path: string, handlers: SseHandlers): SseStream {
  let cerrado = false;
  let intentos = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const conectar = async (): Promise<void> => {
    if (cerrado) return;
    controller = new AbortController();
    try {
      const res = await fetch(path, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      });
      // Un 401 ya lo atendió el interceptor (sesión limpia + redirect). Igual se
      // trata como caída: reintentar contra /login no sirve, pero el `cerrado`
      // que viene con la navegación corta el ciclo.
      if (!res.ok || !res.body) throw new Error(`SSE respondió ${res.status}`);

      intentos = 0;
      handlers.onOpen?.();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        // Normalizar los saltos evita tener que buscar tres separadores
        // distintos (`\n\n`, `\r\n\r\n`, `\r\r`) más abajo.
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n|\r/g, '\n');
        let corte = buffer.indexOf('\n\n');
        while (corte !== -1) {
          const data = parseSseBlock(buffer.slice(0, corte));
          buffer = buffer.slice(corte + 2);
          if (data !== null) handlers.onMessage(data);
          corte = buffer.indexOf('\n\n');
        }
      }
      // El server cerró limpio. Para un stream que debería vivir mientras la
      // vista esté abierta eso también es una caída: se reconecta.
      throw new Error('el server cerró el stream');
    } catch (error) {
      // Un abort es un cierre pedido por nosotros, no una falla.
      if (cerrado || (error as { name?: string } | null)?.name === 'AbortError') return;
      handlers.onError?.(error);
      timer = setTimeout(() => void conectar(), delayDeReconexion(intentos++));
    }
  };

  void conectar();

  return {
    close() {
      cerrado = true;
      if (timer) clearTimeout(timer);
      timer = null;
      controller?.abort();
    },
  };
}
