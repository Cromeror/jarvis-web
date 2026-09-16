import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getChatMessages, listChatSessions, sendChatMessage, startChatSession, stopChatMessage } from '../../lib/chat-api.js';
import type { ChatMessage } from '../../lib/chat-api.js';
import { useChatStream } from '../../hooks/useChatStream.js';

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

/** El texto de un mensaje, recortado: el widget es para intercambios cortos. */
function Burbuja({ mensaje }: { mensaje: ChatMessage }): React.ReactElement {
  const esUsuario = mensaje.role === 'user';
  return (
    <div className={`flex ${esUsuario ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-xs ${
          esUsuario ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-100'
        }`}
      >
        {mensaje.content}
      </div>
    </div>
  );
}

/**
 * Chat flotante, anclado abajo.
 *
 * Es el mismo chat de siempre —la misma sesión, la misma API, el mismo stream—
 * en una ventana que no ocupa la pantalla: la idea es poder preguntar algo sin
 * abandonar lo que estás haciendo, que hoy obliga a irse a `/chat` y volver.
 *
 * Tres decisiones que no son detalle:
 *
 * - **No aparece en `/chat`.** Ahí ya está la conversación completa, y dos
 *   chats sobre la misma sesión en la misma pantalla es una invitación a
 *   escribir en el que no se está mirando.
 * - **Reusa la ÚLTIMA conversación del proyecto**, no abre una nueva cada vez.
 *   Una sesión nueva paga su prompt de arranque y parte el historial en dos; si
 *   no hay ninguna, ahí sí se crea.
 * - **No duplica el render del chat grande** (agrupación pregunta→respuesta,
 *   métricas por turno, adjuntos): es deliberadamente mínimo. Lo que necesita
 *   ese detalle se sigue leyendo en `/chat`, y hay un acceso directo en el
 *   header.
 */
export function FloatingChat(): React.ReactElement | null {
  const { pathname } = useLocation();
  const projectId = projectIdDeLaUrl(pathname);
  const enChat = pathname.startsWith('/chat');

  const [abierto, setAbierto] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length, liveText]);

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

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={projectId ? `Preguntarle a Jarvis sobre ${projectId}` : 'Chat de Jarvis'}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-indigo-700"
      >
        <i className="pi pi-comments text-base" />
        Jarvis
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex h-[520px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--app-bg)] shadow-2xl">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">Jarvis</p>
          <p className="truncate text-[11px] text-slate-400">
            {projectId ?? 'sin proyecto'}
            {active ? ' · trabajando…' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* El detalle completo —agrupación, métricas, adjuntos— vive en /chat.
              El acceso directo evita que el widget tenga que crecer hasta serlo. */}
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

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {!projectId ? (
          <p className="text-xs text-slate-400">
            Elegí un proyecto para conversar: entrá a un chat, un plan, un environment o un paquete.
          </p>
        ) : cargando ? (
          <p className="text-xs text-slate-400">Abriendo la conversación…</p>
        ) : (
          <>
            {mensajes.length === 0 && <p className="text-xs text-slate-500">Todavía no hay mensajes.</p>}
            {mensajes.map((m) => (
              <Burbuja key={m.id} mensaje={m} />
            ))}
            {/* El texto que Jarvis está escribiendo AHORA, que todavía no es una
                fila en la base: sin esto, el widget se ve congelado durante todo
                el turno. */}
            {liveText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300">
                  {liveText}
                </div>
              </div>
            )}
            {pending.length > 0 && (
              <p className="text-[11px] text-slate-500">
                {pending.length} {pending.length === 1 ? 'mensaje en cola' : 'mensajes en cola'}
              </p>
            )}
            <div ref={finRef} />
          </>
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
        {/* Mientras Jarvis trabaja, el botón corta el turno en vez de mandar: el
            input NO se deshabilita —la cola acepta mensajes— pero poder frenar
            es lo que falta cuando algo se fue por un camino equivocado. */}
        {active ? (
          <button
            type="button"
            onClick={() => void (sessionId && stopChatMessage(sessionId))}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
          >
            Parar
          </button>
        ) : (
          <button
            type="button"
            disabled={!texto.trim() || !sessionId}
            onClick={() => void enviar()}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Enviar
          </button>
        )}
      </div>
    </div>
  );
}
