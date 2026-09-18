import React, { useEffect, useRef, useState } from 'react';
import {
  cancelExecutorLogin,
  startExecutorLogin,
  submitExecutorLoginCode,
  watchExecutorLogin,
  type LoginStarted,
} from '../../lib/executor-login-api.js';

type Fase = 'ofrecido' | 'arrancando' | 'esperando_autorizacion' | 'enviando_codigo' | 'ok' | 'error';

/**
 * Pide la sesión del executor ahí mismo, cuando el chat no puede arrancar.
 *
 * El caso: la sesión de Claude se vence y todo turno muere con `Failed to spawn
 * the Claude process`. Antes el chat mostraba el error y ahí quedaba — la
 * persona tenía que saber que existe un botón en otra pantalla, y de qué cuenta
 * se trataba. Ahora el arreglo está donde aparece el problema.
 *
 * El flujo no se puede acortar: el CLI imprime una URL, alguien la abre y
 * autoriza, y el navegador devuelve un código que hay que pegar. Por eso son
 * dos pasos con una espera humana en el medio.
 *
 * `projectId` NO es opcional en la práctica aunque el tipo lo permita: un
 * proyecto aislado lee las credenciales del `$HOME` de su usuario Unix, así que
 * autenticar la cuenta de jarvis-api no arregla su chat — parecería que sí.
 */
export function ExecutorLoginPrompt({
  projectId,
  onResuelto,
}: {
  projectId: string | null;
  /** El login terminó bien: quien lo muestre puede limpiar el error y dejar reintentar. */
  onResuelto?: () => void;
}): React.ReactElement {
  const [fase, setFase] = useState<Fase>('ofrecido');
  const [attempt, setAttempt] = useState<LoginStarted | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [detalle, setDetalle] = useState<string | null>(null);
  const cortarStream = useRef<(() => void) | null>(null);

  /* Lo último que se supo, para el cleanup. Va en refs y no se lee del estado
     porque el cleanup tiene que correr UNA vez, al desmontar, y un cleanup que
     lea estado necesitaría ese estado en las dependencias — que es exactamente
     lo que rompía esto (abajo). */
  const attemptRef = useRef<LoginStarted | null>(null);
  const faseRef = useRef<Fase>('ofrecido');
  attemptRef.current = attempt;
  faseRef.current = fase;

  /* SE CORTA AL DESMONTAR, Y SÓLO AHÍ. Las dependencias eran `[attempt, fase]`,
     así que el cleanup corría en CADA cambio de cualquiera de los dos — y el
     primero que cambia es `attempt`, un renglón antes de que se abra el stream.
     Resultado: React cerraba el stream recién abierto y cancelaba el intento,
     la pantalla se quedaba en «Pidiendo la URL de autorización…» para siempre
     y el backend terminaba el login sin nadie escuchando. El arreglo del
     servidor —que el stream cuente lo ya pasado al conectar— no alcanzaba: no
     había stream vivo al que contárselo.

     El intento se cancela si quedó a medias: un `claude auth login` esperando
     un código que ya nadie va a pegar ocupa el proceso hasta su timeout de 5
     minutos. */
  useEffect(
    () => () => {
      cortarStream.current?.();
      const pendiente = attemptRef.current;
      if (pendiente && faseRef.current !== 'ok') void cancelExecutorLogin(pendiente.attemptId);
    },
    [],
  );

  async function arrancar(): Promise<void> {
    /* REINTENTAR ES EMPEZAR DE CERO, y eso incluye soltar el stream anterior.
       Sin esto quedaban dos abiertos, y como `openSseStream` RECONECTA cuando
       el servidor cierra —que es lo que hace un intento al terminar—, el viejo
       volvía a conectarse, recibía de nuevo el estado terminal que ya tenía
       guardado y pisaba al intento nuevo con su error. El síntoma era el bucle:
       aparecía el link y al instante volvía «Reintentar», sin fin, hasta
       recargar la página. */
    cortarStream.current?.();
    cortarStream.current = null;
    setUrl(null);
    setFase('arrancando');
    setDetalle(null);
    try {
      const iniciado = await startExecutorLogin(projectId);
      setAttempt(iniciado);
      const cortar = watchExecutorLogin(iniciado.attemptId, (evento) => {
        // Un evento de OTRO intento no decide nada de éste: al reintentar
        // rápido puede quedar uno en vuelo, y su terminal no es el nuestro.
        if (evento.attemptId && evento.attemptId !== iniciado.attemptId) return;

        if (evento.type === 'url' && evento.data) {
          setUrl(evento.data);
          setFase('esperando_autorizacion');
        }
        if (evento.type === 'error') {
          setDetalle(evento.data ?? 'El login falló');
          setFase('error');
          /* Terminal: se corta acá. Si no, el servidor cierra su lado, el
             cliente reconecta y vuelve a recibir el mismo final para siempre. */
          cortar();
          if (cortarStream.current === cortar) cortarStream.current = null;
        }
        if (evento.type === 'success') {
          setDetalle(evento.data ? `Sesión abierta como ${evento.data}` : 'Sesión abierta');
          setFase('ok');
          onResuelto?.();
          cortar();
          if (cortarStream.current === cortar) cortarStream.current = null;
        }
      });
      cortarStream.current = cortar;
    } catch (err) {
      setDetalle(err instanceof Error ? err.message : 'No se pudo arrancar el login');
      setFase('error');
    }
  }

  async function enviarCodigo(): Promise<void> {
    if (!attempt || !codigo.trim()) return;
    setFase('enviando_codigo');
    try {
      await submitExecutorLoginCode(attempt.attemptId, codigo.trim());
      // El veredicto llega por el stream, no por esta respuesta: el runner
      // confirma consultando `claude auth status`, que tarda un poco más.
      setCodigo('');
    } catch (err) {
      setDetalle(err instanceof Error ? err.message : 'El código no fue aceptado');
      setFase('error');
    }
  }

  const aQuien =
    attempt?.authenticating && 'unix_user' in attempt.authenticating
      ? `al usuario ${attempt.authenticating.unix_user}`
      : 'a la cuenta de Jarvis';

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
      {fase === 'ofrecido' && (
        <>
          <p className="mb-2">
            Jarvis no pudo arrancar: la sesión del executor está vencida. Se puede volver a iniciar desde acá.
          </p>
          <button
            type="button"
            onClick={() => void arrancar()}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-amber-400"
          >
            Iniciar sesión
          </button>
        </>
      )}

      {fase === 'arrancando' && <p>Pidiendo la URL de autorización…</p>}

      {(fase === 'esperando_autorizacion' || fase === 'enviando_codigo') && (
        <>
          <p className="mb-2">
            Abrí esta URL, autorizá {aQuien} y pegá acá el código que te devuelva:
          </p>
          {/* La URL en un campo de sólo lectura y no como link: es larga, y lo
              que se necesita es copiarla entera —muchas veces para abrirla en
              otro dispositivo—, no navegar desde acá. */}
          <input
            readOnly
            value={url ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            className="mb-2 w-full rounded border border-amber-500/30 bg-black/30 px-2 py-1 font-mono text-[11px] text-amber-100"
          />
          <div className="flex items-center gap-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void enviarCodigo();
              }}
              placeholder="Código"
              className="flex-1 rounded border border-amber-500/30 bg-black/30 px-2 py-1 text-xs text-amber-100 placeholder:text-amber-200/40"
            />
            <button
              type="button"
              disabled={!codigo.trim() || fase === 'enviando_codigo'}
              onClick={() => void enviarCodigo()}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50"
            >
              {fase === 'enviando_codigo' ? 'Verificando…' : 'Confirmar'}
            </button>
          </div>
        </>
      )}

      {fase === 'ok' && <p className="text-emerald-300">{detalle ?? 'Sesión abierta'}. Probá mandar tu mensaje de nuevo.</p>}

      {fase === 'error' && (
        <>
          <p className="mb-2 text-red-300">{detalle}</p>
          <button
            type="button"
            onClick={() => void arrancar()}
            className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
          >
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
