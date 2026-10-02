import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteChatSession,
  getChatMessages,
  listChatSessions,
  renameChatSession,
  sendChatMessage,
  startChatSession,
  stopChatMessage,
} from '../../lib/chat-api.js';
import type { ChatMessage, ChatSession } from '../../lib/chat-api.js';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  DOCUMENT_ATTACHMENT_EXTENSIONS,
  IMAGE_ATTACHMENT_EXTENSIONS,
  attachmentIconName,
  describeAttachment,
  filesToAttachmentInputs,
  splitByAcceptedFormat,
} from '../../lib/chat-attachments.js';
import { useChatStream } from '../../hooks/useChatStream.js';
import { MessageList } from '../ui/molecules/MessageList.js';
import { MenuContextual, type GrupoDeMenu } from '../ui/MenuContextual.js';
import { useActiveProject, useActiveProjectId } from '../../hooks/useActiveProject.js';
import { ubicacionDe } from '../../lib/ubicacion-del-chat.js';
import { useSeleccionDeSuperficie } from '../layout/seleccion-de-superficie.js';
import { Icon } from '../Icon.js';
import '../../theme/islas/empty-state.js';
import { FalloDeArranque } from './FalloDeArranque.js';
import { useTarjetaDelChat } from '../shell/chat-card.js';

/**
 * El menú del `[+]`, con la anatomía del template (`K.agregar.grupos` en
 * `data/content.js`) y sólo los ítems que existen de verdad: «Sumar contexto»
 * y «objetos 3D» son del lienzo del template, acá no hay ni uno ni otro.
 *
 * Son dos ítems y no uno porque filtran distinto el selector de archivos —
 * buscar una captura entre PDFs es el trabajo que el menú ahorra.
 */
const ADD_MENU_GROUPS: GrupoDeMenu[] = [
  {
    items: [
      { id: 'imagen', label: 'Agregar imágenes', icon: 'image' },
      { id: 'archivo', label: 'Agregar archivos (PDF, Markdown)', icon: 'doc' },
    ],
  },
];

/**
 * Las acciones del menú de conversaciones van prefijadas para no poder chocar
 * nunca con un id de sesión: las dos cosas viajan por el mismo `onSelect`, y un
 * uuid no empieza con `::`.
 */
const RENAME = '::renombrar';
const DELETE = '::borrar';


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
 * **Flota sobre el ÁREA DE TRABAJO, no sobre el viewport**: es un item de la
 * grilla de `.sw-container`, puesto en la celda del lienzo (`.sw-flota` en
 * `chat.css`). Así no aterriza encima de la caja de herramientas, y cuando la
 * columna derecha pasa a riel la celda crece y la tarjeta se corre con ella,
 * sin que este componente sepa nada de la columna.
 *
 * **Y flota siempre**: el template ofrece dos ubicaciones —inquilino de la
 * columna o tarjeta— y la elección ya está tomada en `AppShell`, que es también
 * quien pinta el envoltorio `.sw-chat` del que cuelga este layout.
 */
export function FloatingChat(): React.ReactElement | null {
  const projectId = useActiveProjectId();
  /* EL CHAT FLOTA SOBRE TODO y por eso no sabe en qué pantalla lo abrieron.
     La ubicación se lee de la URL en el momento de ENVIAR —no se suscribe a la
     navegación— así que pasear por la web no dispara nada. */
  const { suites } = useActiveProject();
  /* Lo que el módulo tiene marcado — no está en la URL, lo publica él. */
  const { seleccion } = useSeleccionDeSuperficie();
  /* Plegada a pastilla o abierta. `null` en la pantalla completa, donde no hay
     tarjeta que plegar: ahí el botón no se dibuja. */
  const tarjeta = useTarjetaDelChat();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Lo que se va a mandar con el próximo turno. Se vacía recién cuando el server lo aceptó. */
  const [attachments, setAttachments] = useState<File[]>([]);
  /** Nombres de lo último que se intentó adjuntar y el chat no puede leer. */
  const [rejected, setRejected] = useState<string[]>([]);
  /** Dónde se abrió el menú del `[+]`, en coordenadas de ventana. */
  const [addMenuAt, setAddMenuAt] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Las conversaciones del proyecto — lo que lista el menú de la barra. */
  const [sesiones, setSesiones] = useState<ChatSession[]>([]);
  const [listaAt, setListaAt] = useState<{ x: number; y: number } | null>(null);
  /**
   * Borrar pide confirmación, y la pide en OTRO menú anclado al mismo punto, no
   * en un modal: es una acción que se dispara desde un menú y la respuesta
   * vuelve donde estaba el dedo. Un modal centrado para dos palabras saca al
   * usuario de la tarjeta.
   */
  const [confirmarBorrado, setConfirmarBorrado] = useState<{ x: number; y: number } | null>(null);
  /** El título en edición, o `null` si no se está renombrando. `''` es un valor válido. */
  const [renombrando, setRenombrando] = useState<string | null>(null);
  /**
   * El turno murió antes de arrancar el motor, y POR QUÉ.
   *
   * Lo manda el server como una causa clasificada; no se deduce del `step` ni
   * del texto. Antes se asumía que todo fallo de arranque era la sesión
   * vencida, y el chat ofrecía re-loguear para un `root_path` inexistente: el
   * login funcionaba, el chat seguía roto, y no había forma de saber por qué
   * desde la pantalla.
   */
  const [causaDelFallo, setCausaDelFallo] = useState<string | null>(null);

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
    onError: (message, step, cause) => {
      setError(message);
      // Sin causa declarada no se inventa una: se muestra el error crudo, que
      // es más útil que una explicación equivocada.
      setCausaDelFallo(cause ?? (step === 'spawn' ? 'unknown' : null));
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
        // Las propias primero: una conversación ajena se puede ver (quien
        // administra recursos ajenos las lista) pero escribirle desde acá sería
        // meterse en la conversación de otra persona sin querer. Por eso la
        // lista que se guarda —y la que ofrece el menú— es sólo la propia.
        const propias = (await listChatSessions(projectId)).filter((x) => x.propia !== false);
        if (!cancelado) setSesiones(propias);
        const id = propias[0]?.id ?? (await startChatSession(projectId)).session_id;
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
    setSesiones([]);
    // Los adjuntos se van con la conversación: quedaron elegidos para
    // preguntarle algo a ESTE proyecto, y mandarlos al siguiente le escribe
    // archivos en el disco a quien nunca los pidió.
    setAttachments([]);
    setRejected([]);
  }, [projectId]);

  const refrescarSesiones = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    try {
      setSesiones((await listChatSessions(projectId)).filter((x) => x.propia !== false));
    } catch {
      /* la lista se vuelve a pedir la próxima vez que se abra el menú */
    }
  }, [projectId]);

  /** Deja la tarjeta como recién abierta, sin tocar la conversación de la que se viene. */
  function limpiarComposer(): void {
    setTexto('');
    setAttachments([]);
    setRejected([]);
    setError(null);
    setCausaDelFallo(null);
  }

  async function nuevaConversacion(): Promise<void> {
    if (!projectId) return;
    try {
      const { session_id } = await startChatSession(projectId);
      setSessionId(session_id);
      setMensajes([]);
      limpiarComposer();
      void refrescarSesiones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir una conversación nueva');
    }
  }

  function cambiarDeConversacion(id: string): void {
    if (id === sessionId) return;
    setSessionId(id);
    // Vacío y no la lista vieja: el historial de la nueva lo trae el efecto de
    // `sessionId`, y mientras tanto mostrar los mensajes de la anterior bajo el
    // título de esta es decirle al usuario que entró a la equivocada.
    setMensajes([]);
    limpiarComposer();
  }

  async function borrarConversacion(): Promise<void> {
    if (!sessionId) return;
    try {
      await deleteChatSession(sessionId);
      // Soltar la sesión alcanza: el efecto de arranque vuelve a resolver cuál
      // mirar —la siguiente propia, o una nueva si no queda ninguna—, que es la
      // misma decisión que toma al abrir la tarjeta. Repetirla acá sería tener
      // dos lugares donde elegir conversación.
      setSessionId(null);
      setMensajes([]);
      limpiarComposer();
      await refrescarSesiones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar la conversación');
    }
  }

  async function confirmarRenombre(): Promise<void> {
    const titulo = renombrando?.trim();
    setRenombrando(null);
    // Un título vacío no es un renombre: sin esto el campo en blanco borraría
    // el nombre y la conversación quedaría sin con qué distinguirla en la lista.
    if (!sessionId || !titulo) return;
    try {
      await renameChatSession(sessionId, titulo);
      await refrescarSesiones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo renombrar');
    }
  }

  function sumarArchivos(files: FileList | File[]): void {
    const { accepted, rejected: noSePuede } = splitByAcceptedFormat(files);
    // Se avisa cuáles quedaron afuera: descartarlos en silencio deja al usuario
    // esperando una respuesta sobre un archivo que nunca viajó.
    setRejected(noSePuede);
    if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
  }

  /**
   * Abre el selector con un filtro propio. El `accept` se escribe sobre el
   * input en vez de ser estado porque tiene que estar puesto ANTES del click, y
   * el `value = ''` es lo que permite volver a elegir el mismo archivo después
   * de haberlo quitado (sin eso el `change` no se dispara).
   */
  function abrirSelector(extensiones: string[]): void {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = extensiones.join(',');
    input.value = '';
    input.click();
  }

  async function enviar(): Promise<void> {
    const mensaje = texto.trim();
    if ((!mensaje && attachments.length === 0) || !sessionId) return;
    const adjuntados = attachments;
    setTexto('');
    setAttachments([]);
    setRejected([]);
    setError(null);
    try {
      await sendChatMessage(
        sessionId,
        mensaje,
        await filesToAttachmentInputs(adjuntados),
        ubicacionDe(window.location.pathname, suites, seleccion),
      );
      await refrescarHistorial();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar');
      // El texto y los adjuntos vuelven al composer: perderlos por un error de
      // red es peor que tener que apretar enviar otra vez — y volver a buscar
      // los archivos en el disco es peor todavía que reescribir una línea.
      setTexto(mensaje);
      setAttachments(adjuntados);
    }
  }

  /* EL HILO ESTÁ SIEMPRE: es un panel persistente, no un popover. Por eso no
     hay botón de cerrar — el chat es del shell y no se va. */

  const sinProyecto = !projectId;
  const vacio = mensajes.length === 0 && !cargando;

  /**
   * Arrastrar un archivo adentro lo adjunta — y va en el HILO además del
   * composer: soltarlo fuera de una zona que lo acepte hace que el browser
   * abra el archivo y se lleve puesta la pantalla.
   */
  const zonaDeSoltar = {
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.files?.length) return;
      e.preventDefault();
      sumarArchivos(e.dataTransfer.files);
    },
  };

  const cuerpo = (
    <>
      {/* Es un contenedor scrolleable, así que es foco de teclado por derecho
          propio y tiene su anillo en chat.css. */}
      <div
        className={`sw-chat__thread${vacio ? '' : ' is-empezado'}`}
        tabIndex={0}
        aria-label="Conversación"
        {...zonaDeSoltar}
      >
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
                  ? 'Elegí un proyecto para conversar: entrá a un chat, un plan, un environment o una suite.'
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

      {error && !causaDelFallo && <p className="sw-chat__context">{error}</p>}
      {causaDelFallo && (
        <FalloDeArranque
          causa={causaDelFallo}
          detalle={error}
          projectId={projectId}
          onResuelto={() => {
            setCausaDelFallo(null);
            setError(null);
          }}
        />
      )}

      {rejected.length > 0 && (
        <p className="sw-chat__context" role="alert">
          No se puede adjuntar {rejected.join(', ')}: el chat sólo lee imágenes, PDF y Markdown (
          {ACCEPTED_ATTACHMENT_EXTENSIONS.join(', ')}).
        </p>
      )}

      {/* EL COMPOSER. Las ranuras de arriba —integración, adjuntos, contexto—
          se dibujan sólo si hay dato: la de adjuntos ya lo tiene, las otras dos
          todavía no.

          Y «si hay dato» es render condicional, no el atributo `hidden`: las
          ranuras llevan `display: flex` por clase, y una regla de autor le gana
          al `[hidden] { display: none }` del navegador. O sea que una ranura
          «oculta» seguía ocupando su fila con su padding — tres filas vacías
          empujando el campo hacia abajo.

          LOS CONTROLES DEL PIE ESTÁN MOCKEADOS a propósito (pedido explícito):
          varios no tienen contraparte todavía, y se ponen igual para que la
          pantalla esté completa. Vivos: el campo, el [+], y enviar. */}
      <div className="sw-comp" {...zonaDeSoltar}>
        {attachments.length > 0 && (
          <div className="sw-comp__adj">
            {attachments.map((file, i) => (
              <span key={`${file.name}-${i}`} className="sw-comp__adjunto" title={describeAttachment(file)}>
                <Icon name={attachmentIconName(file)} />
                <span className="sw-comp__an">{file.name}</span>
                <button
                  type="button"
                  className="sw-comp__quitar"
                  aria-label={`Quitar ${file.name}`}
                  onClick={() => {
                    setAttachments((prev) => prev.filter((_, j) => j !== i));
                    setRejected([]);
                  }}
                >
                  <Icon name="x" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* El selector de verdad. Oculto y disparado por el menú del [+]: el
            `<input type="file">` nativo no se puede pintar como el template. */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')}
          hidden
          onChange={(e) => {
            if (e.target.files?.length) sumarArchivos(e.target.files);
          }}
        />

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
              else setError('Elegí un proyecto para conversar: entrá a un chat, un plan, un environment o una suite.');
            }
          }}
          onPaste={(e) => {
            // Pegar una captura es la forma más corta de adjuntarla, y la que
            // más se usa: sin esto hay que guardarla en el disco primero.
            const files = Array.from(e.clipboardData.items)
              .filter((item) => item.kind === 'file')
              .map((item) => item.getAsFile())
              .filter((f): f is File => f !== null);
            if (files.length) sumarArchivos(files);
          }}
          placeholder="Pedí un cambio, preguntá algo, o describí lo que querés hacer…"
          aria-label="Pedí un cambio, preguntá algo, o describí lo que querés hacer"
        />

        <div className="sw-comp__pie">
          <div className="sw-comp__lado">
            <button
              className="sw-comp__mas"
              type="button"
              aria-label="Agregar"
              title="Agregar"
              aria-haspopup="menu"
              aria-expanded={addMenuAt !== null}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setAddMenuAt({ x: r.left, y: r.top });
              }}
            >
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
              disabled={!active && !texto.trim() && attachments.length === 0}
              aria-label={active ? 'Detener' : 'Enviar'}
              title={active ? 'Detener' : 'Enviar'}
              onClick={() => {
                if (active && sessionId) void stopChatMessage(sessionId);
                else if (sessionId) void enviar();
                else setError('Elegí un proyecto para conversar: entrá a un chat, un plan, un environment o una suite.');
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

      {addMenuAt && (
        <MenuContextual
          x={addMenuAt.x}
          y={addMenuAt.y}
          groups={ADD_MENU_GROUPS}
          onCerrar={() => setAddMenuAt(null)}
          onSelect={(id) => {
            setAddMenuAt(null);
            abrirSelector(id === 'imagen' ? IMAGE_ATTACHMENT_EXTENSIONS : DOCUMENT_ATTACHMENT_EXTENSIONS);
          }}
        />
      )}
    </>
  );

  /* El rótulo de la barra dejó de ser la palabra «Conversación»: dice CUÁL
     estás mirando, que es lo que hace falta cuando hay varias. Sin título
     todavía —una recién creada— cae en el genérico, porque el backend lo deriva
     del primer mensaje. */
  const tituloActual = sesiones.find((x) => x.id === sessionId)?.title ?? 'Conversación';
  const plegada = tarjeta?.minimizada ?? false;

  /* La lista y las acciones en UN solo menú, en dos grupos: arriba a cuál ir,
     abajo qué hacerle a la que estás mirando. `MenuContextual` dibuja solo el
     separador entre grupos.

     Las acciones son de la conversación ABIERTA y no de cada fila: el menú del
     template no tiene controles por ítem —es una lista de opciones, no una
     tabla—, y meterlos a mano sería otro componente con el mismo aspecto. Para
     borrar otra, se entra primero; es un clic más en el caso menos frecuente. */
  const gruposDeConversaciones: GrupoDeMenu[] = [
    // Un grupo vacío igual dibuja su caja, o sea un separador suelto arriba de
    // las acciones. Sin conversaciones todavía, el menú es sólo las acciones.
    ...(sesiones.length
      ? [
          {
            items: sesiones.map((x) => ({
              id: x.id,
              label: x.title ?? 'Conversación sin título',
              // `checked` presente (aunque sea false) convierte la fila en
              // menuitemcheckbox: es lo que dice cuál estás mirando. Y ocupa la
              // ranura del ícono, así que un `icon` acá no se vería.
              checked: x.id === sessionId,
            })),
          },
        ]
      : []),
    {
      items: [
        { id: RENAME, label: 'Renombrar', icon: 'pen', disabled: !sessionId },
        { id: DELETE, label: 'Borrar conversación', icon: 'trash', danger: true, disabled: !sessionId },
      ],
    },
  ];

  return (
    <>
      {/* LA BARRA DE LA TARJETA. Dice cuál conversación es, y es desde donde se
          crea, se cambia, se renombra y se borra. */}
      {/* PLEGADA, LA PASTILLA ENTERA ABRE. Un blanco de 28px en una barra que
          mide lo mismo que la pastilla es pedirle puntería a alguien que ya
          decidió: plegado, lo único que se puede hacer con esto es abrirlo, así
          que todo el control hace esa única cosa.

          Abierta NO se toca: ahí la barra tiene varios controles y un clic al
          lado del título plegaría el chat sin que nadie lo pidiera.

          No lleva `role="button"` ni `tabIndex`: el botón de adentro ya es el
          control accesible y hace exactamente esto. Un segundo foco para la
          misma acción le agrega una parada al Tab y no habilita nada nuevo. */}
      <header
        className="sw-flota__barra"
        data-plegada={plegada ? '' : undefined}
        onClick={plegada ? tarjeta?.alternar : undefined}
      >
        <Icon name="message" />
        {renombrando === null ? (
          <span className="sw-flota__t">{tituloActual}</span>
        ) : (
          <input
            className="sw-flota__t"
            data-editando=""
            value={renombrando}
            autoFocus
            aria-label="Nombre de la conversación"
            onChange={(e) => setRenombrando(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirmarRenombre();
              // Escape descarta: el nombre viejo sigue siendo válido, así que
              // salir sin guardar tiene que dejarlo como estaba.
              else if (e.key === 'Escape') setRenombrando(null);
            }}
            onBlur={() => void confirmarRenombre()}
          />
        )}
        {/* EN PASTILLA QUEDA SÓLO EL BOTÓN DE ABRIR. Plegada, la tarjeta es el
            estado más barato de todos: sumarle los controles de conversación la
            ensancharía justo para lo contrario de por qué se plegó. Crear o
            cambiar de conversación son cosas que se hacen mirando el hilo. */}
        {!plegada && (
          <>
            <button
              className="sw-flota__btn"
              type="button"
              aria-label="Nueva conversación"
              title="Nueva conversación"
              disabled={!projectId}
              onClick={() => void nuevaConversacion()}
            >
              <Icon name="plus" />
            </button>
            <button
              className="sw-flota__btn"
              type="button"
              aria-label="Elegir conversación"
              title="Elegir conversación"
              aria-haspopup="menu"
              aria-expanded={listaAt !== null}
              disabled={!projectId}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                // Se refresca al ABRIR y no en un intervalo: la lista sólo tiene
                // que estar fresca en el momento en que se la mira.
                void refrescarSesiones();
                setListaAt({ x: r.left, y: r.bottom });
              }}
            >
              <Icon name="chevron" />
            </button>
          </>
        )}
        {tarjeta && (
          /* DOS GLIFOS, UN CONTROL, como el enviar/detener del composer: `minus`
             para plegar y `chevronUp` para volver a abrir. Es el mismo botón del
             template (`pintarMin` en `side-column.js`). */
          <button
            className="sw-flota__btn"
            type="button"
            aria-label={plegada ? 'Abrir la conversación' : 'Minimizar la conversación'}
            title={plegada ? 'Abrir la conversación' : 'Minimizar la conversación'}
            aria-expanded={!plegada}
            onClick={(e) => {
              // Plegada, el clic ya lo atiende la barra: sin cortarlo acá el
              // evento burbujea y la abre y la vuelve a cerrar en el mismo clic.
              e.stopPropagation();
              tarjeta.alternar();
            }}
          >
            <Icon name={plegada ? 'chevronUp' : 'minus'} />
          </button>
        )}
      </header>

      {/* El envoltorio del que cuelga todo el layout del chat — ver AppShell.

          Plegada NO se renderiza, en vez de taparse con el `display: none` del
          CSS: así el hilo y el composer salen del orden de tabulación (regla 3
          de §11) sin depender de `inert`, que React 18 no tipa. Lo que NO para
          es la conversación —el stream y el historial viven en este componente,
          que sigue montado—: plegar es dejar de ver, no dejar de escuchar, así
          que al abrir ya está al día. */}
      {!plegada && <div className="sw-chat">{cuerpo}</div>}

      {listaAt && (
        <MenuContextual
          x={listaAt.x}
          y={listaAt.y}
          groups={gruposDeConversaciones}
          onCerrar={() => setListaAt(null)}
          onSelect={(id) => {
            setListaAt(null);
            if (id === RENAME) setRenombrando(tituloActual === 'Conversación' ? '' : tituloActual);
            else if (id === DELETE) setConfirmarBorrado(listaAt);
            else cambiarDeConversacion(id);
          }}
        />
      )}

      {confirmarBorrado && (
        <MenuContextual
          x={confirmarBorrado.x}
          y={confirmarBorrado.y}
          groups={[
            {
              items: [
                { id: 'si', label: `Borrar «${tituloActual}»`, icon: 'trash', danger: true },
                { id: 'no', label: 'Cancelar' },
              ],
            },
          ]}
          onCerrar={() => setConfirmarBorrado(null)}
          onSelect={(id) => {
            setConfirmarBorrado(null);
            if (id === 'si') void borrarConversacion();
          }}
        />
      )}
    </>
  );
}
