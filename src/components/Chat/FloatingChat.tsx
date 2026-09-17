import React, { useCallback, useEffect, useState } from 'react';
import { getChatMessages, listChatSessions, sendChatMessage, startChatSession, stopChatMessage } from '../../lib/chat-api.js';
import type { ChatMessage } from '../../lib/chat-api.js';
import { useChatStream } from '../../hooks/useChatStream.js';
import { MessageList } from '../ui/molecules/MessageList.js';
import { useActiveProjectId } from '../../hooks/useActiveProject.js';
import { Icon } from '../Icon.js';
import '../../theme/islas/empty-state.js';
import { ExecutorLoginPrompt } from './ExecutorLoginPrompt.js';


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
  const projectId = useActiveProjectId();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * El turno murió antes de arrancar el motor: casi siempre la sesión del
   * executor vencida. Se distingue por el `step` que manda el server, no por el
   * texto del mensaje — ahí el chat puede ofrecer el arreglo en vez de sólo
   * mostrar el error.
   */
  const [sinSesionDelExecutor, setSinSesionDelExecutor] = useState(false);

  const refrescarHistorial = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      setMensajes(await getChatMessages(sessionId));
    } catch {
      /* el stream vuelve a pedirlo en el próximo evento */
    }
  }, [sessionId]);

  const { active, liveText, pending } = useChatStream(sessionId, {
    onHistoryChanged: () => void refrescarHistorial(),
    onError: (message, step) => {
      setError(message);
      if (step === 'spawn') setSinSesionDelExecutor(true);
    },
  });

  // La conversación se resuelve al ABRIR, no al montar: el widget está en todas
  // las pantallas y no puede costar una llamada por navegación a quien nunca lo
  // usa.
  useEffect(() => {
    if (!projectId || sessionId) return;
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
  }, [projectId, sessionId]);

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

  /* EL HILO ESTÁ SIEMPRE. Desde que vive en la columna lateral es un panel
     persistente, no un popover: por eso no hay botón de cerrar — cerrarlo
     dejaría la columna vacía sin nada que hacer con el hueco.

     Ya no se esconde en /chat. Esa excepción existía cuando el chat flotaba
     encima del trabajo; anclado en la columna es el mismo panel que en el resto
     de la app, y esconderlo dejaría el hueco que muestra el adjunto. */

  const sinProyecto = !projectId;
  const vacio = mensajes.length === 0 && !cargando;

  const cuerpo = (
    <>
      {/* Es un contenedor scrolleable, así que es foco de teclado por derecho
          propio y tiene su anillo en chat.css. */}
      <div
        className={`sw-chat__thread${vacio ? '' : ' is-empezado'}`}
        tabIndex={0}
        aria-label="Conversación"
      >
        <div className="sw-chat__msgs">
          {sinProyecto ? null : cargando ? null : (
            /* La MISMA lista que la pantalla completa. Lo que no se le pasa acá
               —cola editable, apertura de planes— no es una versión recortada:
               son controles que necesitan pantalla, y la lista los omite sola
               cuando no recibe sus handlers. */
            <MessageList
              sessionId={sessionId}
              messages={mensajes}
              pending={active}
              liveText={liveText}
              onStop={active && sessionId ? () => void stopChatMessage(sessionId) : undefined}
            />
          )}
        </div>

        {/* EL HILO VACÍO — el componente Empty de Basecoat, el mismo de shadcn:
            quien recién llega no sabe qué es esto. Un ícono, qué es y qué hacer,
            y las sugerencias ADENTRO en vez de sueltas entre el hilo y el
            composer. Se va con el primer mensaje. */}
        {vacio && (
          <div className="sw-chat__vacio empty">
            <header>
              {/* EL CAMPO DE PUNTOS DETRÁS DEL ÍCONO. Es EL MISMO dibujo que el
                  de los vacíos de sección, no una copia: lo publica la isla
                  `empty-state.js` en `window.SW.vacio.marca()`. Copiarlo daría
                  dos campos que se parecen hoy y se separan en el primer ajuste.

                  Van en un <figure> y superpuestos —el CSS les da a los dos
                  `grid-area: 1/1`—, así que el ícono queda encima y centrado: la
                  figura pasa a ser el marco. */}
              <figure>
                <span
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: window.SW?.vacio?.marca?.() ?? '' }}
                />
                <span className="sw-chat__vacioIco">
                  <Icon name="mensajes" />
                </span>
              </figure>
              <h3>Empezá una conversación</h3>
              <p>
                {sinProyecto
                  ? 'Elegí un proyecto para conversar: entrá a un chat, un plan, un environment o un paquete.'
                  : 'Jarvis puede cambiar lo que tenés abierto, explicarte algo o armarlo con vos.'}
              </p>
            </header>
            <section className="sw-chat__chips">
              <button className="sw-chat__chip" type="button" onClick={() => setTexto('¿Qué puedo hacer acá?')}>
                ¿Qué puedo hacer acá?
              </button>
              <button className="sw-chat__chip" type="button" onClick={() => setTexto('Mostrame un ejemplo')}>
                Mostrame un ejemplo
              </button>
            </section>
          </div>
        )}
      </div>

      {error && !sinSesionDelExecutor && <p className="sw-chat__context">{error}</p>}
      {sinSesionDelExecutor && (
        <ExecutorLoginPrompt
          projectId={projectId}
          onResuelto={() => {
            setSinSesionDelExecutor(false);
            setError(null);
          }}
        />
      )}

      {/* EL COMPOSER. Las ranuras de arriba —integración, adjuntos, contexto—
          se dibujan sólo si hay dato; hoy ninguna tiene, así que arranca en
          campo y pie, que es como arranca el template.

          LOS CONTROLES DEL PIE ESTÁN MOCKEADOS a propósito (pedido explícito):
          varios no tienen contraparte todavía, y se ponen igual para que la
          pantalla esté completa. Lo único vivo es el campo y enviar. */}
      <div className="sw-comp">
        <div className="sw-comp__integra" hidden />
        <div className="sw-comp__adj" hidden />
        <div className="sw-comp__ctx" hidden />

        <textarea
          className="sw-comp__campo"
          rows={1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía y Shift+Enter hace salto, como el composer grande.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              // Sin sesión no se manda, pero lo escrito NO se pierde: queda en
              // el campo y el error dice qué falta.
              if (sessionId) void enviar();
              else setError('Elegí un proyecto para conversar: entrá a un chat, un plan, un environment o un paquete.');
            }
          }}
          placeholder="Pedí un cambio, preguntá algo, o describí lo que querés hacer…"
          aria-label="Pedí un cambio, preguntá algo, o describí lo que querés hacer"
        />

        <div className="sw-comp__pie">
          <div className="sw-comp__lado">
            <button className="sw-comp__mas" type="button" aria-label="Agregar" title="Agregar">
              <Icon name="plus" />
            </button>
            {/* Herramientas es una pastilla CON modificador, y sin ícono: el
                template la arma como `sw-comp__pill sw-comp__herr` con sólo el
                rótulo y el chevron. */}
            <button className="sw-comp__pill sw-comp__herr" type="button" aria-haspopup="menu" aria-expanded="false">
              <span>Herramientas</span>
              <Icon name="chevron" />
            </button>
            <button className="sw-comp__pill" type="button" aria-haspopup="menu" aria-expanded="false">
              <Icon name="message" />
              <span>Normal</span>
              <Icon name="chevron" />
            </button>
          </div>
          <div className="sw-comp__lado">
            {/* `sw-comp__modelo` es un MODIFICADOR, no una clase suelta: el
                template hace `pastilla()` —que ya es `.sw-comp__pill`— y recién
                después le agrega el modificador. Sin la base no hay layout de
                pastilla, y el chevron se caía al renglón de abajo. */}
            <button className="sw-comp__pill sw-comp__modelo" type="button" aria-haspopup="menu" aria-expanded="false">
              <span>Opus 5</span>
              <Icon name="chevron" />
            </button>
            {/* UN CONTROL, DOS GLIFOS: mientras genera es detener y cuando
                termina vuelve a ser la flecha. Enviar y detener no conviven. */}
            <button
              className="sw-comp__send"
              type="button"
              disabled={!active && !texto.trim()}
              aria-label={active ? 'Detener' : 'Enviar'}
              title={active ? 'Detener' : 'Enviar'}
              onClick={() => {
                if (active && sessionId) void stopChatMessage(sessionId);
                else if (sessionId) void enviar();
                else setError('Elegí un proyecto para conversar: entrá a un chat, un plan, un environment o un paquete.');
              }}
            >
              <Icon name={active ? 'stop' : 'avanzar'} />
            </button>
          </div>
        </div>

        <p className="sw-comp__ayuda">
          <span className="sw-chat__kbd">Shift + Enter</span> para una línea nueva
        </p>
      </div>

      {pending.length > 0 && (
        <p className="sw-comp__ayuda">
          {pending.length} {pending.length === 1 ? 'mensaje en cola' : 'mensajes en cola'}
        </p>
      )}
    </>
  );

  return cuerpo;
}
