import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { getChatMessages, listChatSessions, sendChatMessage, startChatSession, stopChatMessage } from '../../lib/chat-api.js';
import type { ChatMessage } from '../../lib/chat-api.js';
import { useChatStream } from '../../hooks/useChatStream.js';
import { MessageList } from '../ui/molecules/MessageList.js';
import { useWorkspaceAnchor } from '../layout/workspace-anchor.js';

/**
 * De qué proyecto es la conversación: el de la URL.
 *
 * Misma resolución que el sidebar dinámico (`projectIdDeLaUrl`) y por la misma
 * razón: no hay un contexto global de proyecto en la SPA. Sin proyecto en la
 * ruta no hay a quién preguntarle, y el widget lo dice en vez de elegir uno
 * por su cuenta — abrir una conversación contra un proyecto que el usuario no
 * eligió es peor que no abrir ninguna.
 */
function projectIdDeLaUrl(pathname: string): string | null {
  const [, seccion, posibleProyecto] = pathname.split('/');
  const CON_PROYECTO = ['chat', 'plans', 'environments', 'workspaces', 'paquetes'];
  if (!seccion || !CON_PROYECTO.includes(seccion)) return null;
  return posibleProyecto || null;
}

/**
 * El chat, en una ventana que acompaña al trabajo.
 *
 * **No es un segundo chat**: es el mismo. La misma sesión, la misma API, el
 * mismo `useChatStream` y —desde que se sacó el render propio— la misma
 * `MessageList` que la pantalla completa, con su agrupación pregunta→respuesta,
 * sus métricas y su panel de cola. Lo único distinto es dónde se presenta.
 * Tener dos renders era garantía de que uno se quedara atrás: el que se arregla
 * es siempre el que se está mirando.
 *
 * **Flota sobre el ÁREA DE TRABAJO, no sobre el viewport** (`absolute` dentro
 * del anchor, no `fixed`): así no tapa el rail derecho de una página que lo
 * tenga, y cuando ese rail se colapsa el área se ensancha y la ventana se
 * corre sola, sin saber nada del rail.
 *
 * No aparece en `/chat`: ahí ya está la conversación completa, y dos vistas de
 * la misma sesión en la misma pantalla invitan a escribir en la que no se está
 * mirando.
 */
export function FloatingChat(): React.ReactElement | null {
  const { pathname } = useLocation();
  const anchor = useWorkspaceAnchor();
  const projectId = projectIdDeLaUrl(pathname);
  const enChat = pathname.startsWith('/chat');

  const [abierto, setAbierto] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescarHistorial = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      setMensajes(await getChatMessages(sessionId));
    } catch {
      /* el stream vuelve a pedirlo en el próximo evento */
    }
  }, [sessionId]);

  const { active, liveText, pending } = useChatStream(abierto ? sessionId : null, {
    onHistoryChanged: () => void refrescarHistorial(),
    onError: (message) => setError(message),
  });

  // La conversación se resuelve al ABRIR, no al montar: el widget está en todas
  // las pantallas y no puede costar una llamada por navegación a quien nunca lo
  // usa.
  useEffect(() => {
    if (!abierto || !projectId || sessionId) return;
    let cancelado = false;
    setCargando(true);
    void (async () => {
      try {
        const sesiones = await listChatSessions(projectId);
        // Las propias primero: una conversación ajena se puede ver (quien
        // administra recursos ajenos las lista) pero escribirle desde acá sería
        // meterse en la conversación de otra persona sin querer.
        const propia = sesiones.find((s) => s.propia !== false);
        const id = propia?.id ?? (await startChatSession(projectId)).session_id;
        if (!cancelado) setSessionId(id);
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo abrir la conversación');
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [abierto, projectId, sessionId]);

  useEffect(() => {
    if (sessionId) void refrescarHistorial();
  }, [sessionId, refrescarHistorial]);

  // Cambiar de proyecto cambia de conversación: si no, el widget seguiría
  // escribiéndole al proyecto anterior desde una pantalla que ya es de otro.
  useEffect(() => {
    setSessionId(null);
    setMensajes([]);
  }, [projectId]);

  async function enviar(): Promise<void> {
    const mensaje = texto.trim();
    if (!mensaje || !sessionId) return;
    setTexto('');
    setError(null);
    try {
      await sendChatMessage(sessionId, mensaje);
      await refrescarHistorial();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar');
      // El texto vuelve al input: perderlo por un error de red es peor que
      // tener que apretar enviar otra vez.
      setTexto(mensaje);
    }
  }

  if (enChat) return null;

  const contenido = !abierto ? (
    <button
      type="button"
      onClick={() => setAbierto(true)}
      title={projectId ? `Preguntarle a Jarvis sobre ${projectId}` : 'Chat de Jarvis'}
      className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-indigo-700"
    >
      <i className="pi pi-comments text-base" />
      Jarvis
    </button>
  ) : (
    <div className="absolute bottom-4 right-4 z-30 flex h-[min(560px,calc(100%-2rem))] w-[380px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--app-bg)] shadow-2xl">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">Jarvis</p>
          <p className="truncate text-[11px] text-slate-400">
            {projectId ?? 'sin proyecto'}
            {active ? ' · trabajando…' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* La misma conversación, en la pantalla completa: mismo historial,
              con el resto de sus controles (adjuntos, selector de sesión). */}
          {projectId && (
            <a
              href={`/chat/${projectId}${sessionId ? `/${sessionId}` : ''}`}
              title="Abrir la conversación completa"
              className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <i className="pi pi-external-link" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setAbierto(false)}
            title="Minimizar"
            className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <i className="pi pi-minus" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {!projectId ? (
          <p className="p-3 text-xs text-slate-400">
            Elegí un proyecto para conversar: entrá a un chat, un plan, un environment o un paquete.
          </p>
        ) : cargando ? (
          <p className="p-3 text-xs text-slate-400">Abriendo la conversación…</p>
        ) : (
          // La MISMA lista que la pantalla completa. Lo que no se le pasa acá
          // —cola editable, apertura de planes— no es una versión recortada del
          // render: son controles que necesitan pantalla, y la lista los omite
          // sola cuando no recibe sus handlers.
          <MessageList
            sessionId={sessionId}
            messages={mensajes}
            pending={active}
            liveText={liveText}
            onStop={active && sessionId ? () => void stopChatMessage(sessionId) : undefined}
          />
        )}
      </div>

      {error && <p className="px-3 pb-1 text-[11px] text-red-300">{error}</p>}

      <div className="flex items-end gap-2 border-t border-white/10 p-2">
        <textarea
          rows={2}
          value={texto}
          disabled={!projectId || !sessionId}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía y Shift+Enter hace salto, como el composer grande.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          placeholder={projectId ? 'Escribile a Jarvis…' : 'Elegí un proyecto'}
          className="min-h-[38px] flex-1 resize-none rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-400 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!texto.trim() || !sessionId}
          onClick={() => void enviar()}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
      {pending.length > 0 && (
        <p className="px-3 pb-2 text-[11px] text-slate-500">
          {pending.length} {pending.length === 1 ? 'mensaje en cola' : 'mensajes en cola'}
        </p>
      )}
    </div>
  );

  // Sin anchor todavía (primer render, antes de que el shell registre el suyo)
  // no se dibuja: un fallback a `document.body` volvería al `fixed` que este
  // componente dejó de usar, y se vería saltar de lugar.
  return anchor ? createPortal(contenido, anchor) : null;
}
