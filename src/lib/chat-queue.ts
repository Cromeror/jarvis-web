import type { ChatMessage } from './chat-api.js';

/**
 * Lógica pura de la lista del chat: agrupar el historial en bloques
 * pregunta(s)→respuesta, y decidir qué estado de cola le toca a cada burbuja.
 *
 * Vive separada de los componentes a propósito. Es la parte del chat con más
 * casos borde (un turno que contesta varios mensajes, historial sin atribución,
 * burbujas optimistas sin uuid todavía) y la que más barato sale verificar sin
 * montar React: son funciones de datos a datos.
 */

/** Estado de un mensaje del usuario que Jarvis todavía no contestó. */
export type QueueState = 'sending' | 'queued' | 'started';

/** Un mensaje encolado tal como lo reporta el evento `queue` del stream. */
export interface QueuedCommandLike {
  uuid: string;
  state: 'queued' | 'started';
}

/** Un bloque de la conversación: las preguntas que contestó un turno, y su respuesta. */
export interface MessageGroup {
  key: string;
  questions: ChatMessage[];
  /** Ausente mientras las preguntas del bloque siguen sin contestar (en cola o respondiéndose). */
  answer?: ChatMessage;
}

/**
 * Reordena el historial plano en bloques pregunta(s) → respuesta.
 *
 * Hace falta porque el mensaje del usuario se persiste al ENCOLARLO, no al
 * contestarlo: si mandás tres seguidos, el orden crudo en la base es
 * `q1 q2 q3 a1 a2`, y mirándolo no hay forma de saber que `a2` contesta a `q2`
 * y `q3` juntos. Cada respuesta trae `answers_command_uuids` — los uuids que
 * ese turno contestó — así que se puede poner cada respuesta pegada a sus
 * propias preguntas y leer la conversación en el orden en que se preguntó.
 *
 * Fail-soft por diseño: un mensaje sin atribución (historial anterior a esto,
 * o el camino spawn-per-turn que no tiene cola) se emite en su posición
 * original, en su propio bloque. Nunca se pierde ni se duplica un mensaje:
 * cada uno sale exactamente una vez.
 */
export function groupByAnsweredQuestion(messages: ChatMessage[]): MessageGroup[] {
  const byUuid = new Map<string, ChatMessage>();
  for (const m of messages) {
    if (m.role === 'user' && m.command_uuid) byUuid.set(m.command_uuid, m);
  }

  // Preguntas que alguna respuesta reclama: se emiten con ella, no sueltas.
  const claimed = new Set<number>();
  for (const m of messages) {
    for (const uuid of m.answers_command_uuids ?? []) {
      const question = byUuid.get(uuid);
      if (question) claimed.add(question.id);
    }
  }

  const groups: MessageGroup[] = [];
  let orphanQuestions: ChatMessage[] = [];

  const flushOrphans = () => {
    if (orphanQuestions.length === 0) return;
    groups.push({ key: `pending-${orphanQuestions[0]!.id}`, questions: orphanQuestions });
    orphanQuestions = [];
  };

  for (const m of messages) {
    if (m.role === 'user') {
      // Sin reclamar = todavía sin contestar (en cola), o sin atribución.
      if (!claimed.has(m.id)) orphanQuestions.push(m);
      continue;
    }

    const answered = (m.answers_command_uuids ?? [])
      .map((uuid) => byUuid.get(uuid))
      .filter((q): q is ChatMessage => Boolean(q));

    if (answered.length === 0) {
      // Respuesta sin atribución: se queda donde estaba, arrastrando las
      // preguntas sueltas que la preceden — que es el comportamiento viejo.
      groups.push({ key: `msg-${m.id}`, questions: orphanQuestions, answer: m });
      orphanQuestions = [];
      continue;
    }

    flushOrphans();
    groups.push({ key: `msg-${m.id}`, questions: answered, answer: m });
  }

  flushOrphans();
  return groups;
}

/**
 * Qué estado de cola le toca a cada mensaje en pantalla, por id de fila.
 *
 * Se matchea por `command_uuid` — el mismo id con el que el mensaje se encoló
 * en el CLI y con el que después la respuesta lo referencia. Por posición o por
 * texto sería frágil: dos mensajes iguales ("hola" y "hola") colisionan.
 *
 * `optimisticUuids` mapea el id local de una burbuja recién enviada al uuid que
 * le asignó el backend (null mientras el POST no respondió). Sin uuid la
 * burbuja igual se marca 'sending': el hueco entre el click y el primer evento
 * del stream no debe quedar sin ninguna marca.
 */
export function resolveQueueStates(
  messages: ChatMessage[],
  pendingCommands: QueuedCommandLike[],
  optimisticUuids: Map<number, string | null> = new Map(),
): Map<number, QueueState> {
  const states = new Map<number, QueueState>();
  const stateByUuid = new Map(pendingCommands.map((c) => [c.uuid, c.state] as const));

  for (const [optimisticId, uuid] of optimisticUuids) {
    states.set(optimisticId, (uuid && stateByUuid.get(uuid)) || 'sending');
  }

  for (const message of messages) {
    const state = message.command_uuid ? stateByUuid.get(message.command_uuid) : undefined;
    if (state) states.set(message.id, state);
  }
  return states;
}

/**
 * Cuántos mensajes están ESPERANDO su turno — los que ya arrancaron no cuentan.
 *
 * Es el número del pill de la ThinkingRow, y es distinto del total de la cola:
 * el panel lista todo (incluido el que se está contestando) porque para decidir
 * qué sacar hay que ver cuál ya es tarde.
 */
export function countWaiting(states: Map<number, QueueState>): number {
  return Array.from(states.values()).filter((s) => s !== 'started').length;
}

/**
 * ¿Se puede sacar este mensaje de la cola?
 *
 * Solo mientras no arrancó. Verificado contra el CLI real 2.1.220: un
 * `cancel_async_message` sobre un mensaje ya drenado al turno es no-op
 * ("No-op if already dequeued for execution"), así que ofrecer el botón ahí
 * sería prometer algo que no pasa — ese se corta con el stop del turno.
 */
export function isRemovableFromQueue(state: QueueState | undefined): boolean {
  return state === 'queued' || state === 'sending';
}

/**
 * Saca de la cola el mensaje que el CLI confirmó como cancelado.
 *
 * Espeja lo que hace `cancel_async_message`, verificado contra el CLI real
 * 2.1.220: el mensaje pasa de `queued` a `cancelled` sin ejecutarse y el turno
 * en curso sigue intacto. De ahí las dos reglas de acá — un uuid desconocido no
 * cambia nada, y uno ya `started` tampoco: el control es no-op sobre él ("No-op
 * if already dequeued for execution"), así que su fila no debe desaparecer de
 * la lista como si se hubiera cancelado.
 *
 * Devuelve el mismo array cuando no hay nada que sacar, para que un re-render
 * no se dispare por gusto.
 */
export function applyCancelledMessage(pending: QueuedCommandLike[], uuid: string): QueuedCommandLike[] {
  const target = pending.find((c) => c.uuid === uuid);
  if (!target || target.state === 'started') return pending;
  return pending.filter((c) => c.uuid !== uuid);
}

/** Una tarea en background tal como la reporta `system/background_tasks_changed`. */
export interface BackgroundTaskLike {
  task_id: string;
  /**
   * `local_bash` | `monitor_mcp` | `monitor_ws` | `mcp_task` | `local_agent` |
   * `local_workflow` | `in_process_teammate`. String abierto a propósito: el
   * catálogo lo define el CLI y crece sin avisarnos, así que una tarea de un
   * tipo que no conocemos se muestra igual en vez de desaparecer.
   */
  task_type: string;
  description: string;
}

/** Lo que la barra sticky necesita para renderizarse. */
export interface BackgroundSummary {
  visible: boolean;
  count: number;
  tasks: BackgroundTaskLike[];
}

/**
 * Resume las tareas vivas para la barra del pie.
 *
 * El evento del CLI manda la lista COMPLETA cada vez (llega `tasks: []` cuando
 * se vació), así que esto reemplaza el estado, nunca acumula: sumar dejaría
 * tareas fantasma que ya terminaron.
 *
 * No mira si el turno está abierto — y es deliberado. Verificado contra el CLI
 * real: el `result` del turno llega ANTES del `task_notification`, o sea que una
 * tarea sobrevive al turno que la lanzó. Atar la barra al turno la haría
 * desaparecer con trabajo todavía corriendo.
 */
export function summarizeBackgroundTasks(
  tasks: BackgroundTaskLike[],
  _opts?: { turnOpen?: boolean },
): BackgroundSummary {
  return { visible: tasks.length > 0, count: tasks.length, tasks };
}
