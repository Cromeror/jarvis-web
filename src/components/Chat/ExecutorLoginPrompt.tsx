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

  // El stream se corta al desmontar, y el intento se cancela si quedó a medias:
  // un `claude auth login` vivo esperando un código que ya nadie va a pegar se
  // queda ocupando el proceso hasta su timeout de 5 minutos.
  useEffect(
    () => () => {
      cortarStream.current?.();
      if (attempt && fase !== 'ok') void cancelExecutorLogin(attempt.attemptId);
    },
    [attempt, fase],
  );

  async function arrancar(): Promise<void> {
    setFase('arrancando');
    setDetalle(null);
    try {
      const iniciado = await startExecutorLogin(projectId);
      setAttempt(iniciado);
      cortarStream.current = watchExecutorLogin(iniciado.attemptId, (evento) => {
        if (evento.type === 'url' && evento.data) {
          setUrl(evento.data);
          setFase('esperando_autorizacion');
        }
        if (evento.type === 'error') {
          setDetalle(evento.data ?? 'El login falló');
          setFase('error');
        }
        if (evento.type === 'success') {
          setDetalle(evento.data ? `Sesión abierta como ${evento.data}` : 'Sesión abierta');
          setFase('ok');
          onResuelto?.();
        }
      });
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
