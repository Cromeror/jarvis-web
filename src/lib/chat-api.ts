/**
 * API client for chat endpoints (packages/mcp/src/api/chat.ts).
 */

export interface ChatSession {
  id: string;
  project_id: string | null;
  title: string | null;
  native_session_id: string | null;
  created_at: string;
  updated_at: string;
  /**
   * En qué workspace corre esta conversación: null = el root_path del
   * proyecto (la base), un id = la réplica a la que se la movió. Opcional
   * para no romper contra un server viejo que no lo mande — ausente se lee
   * igual que null, que es lo que era antes de que esto existiera.
   */
  replica_id?: string | null;
  /**
   * Hay un turno sin contestar y un proceso vivo que lo está contestando. Lo
   * calcula el server contra el pool en cada `list()` — no es una columna, así
   * que solo es fresco al momento del fetch. Opcional a propósito: fail-soft
   * si la respuesta viene de un server viejo.
   */
  busy?: boolean;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  created_at: string;
  input_tokens: number | null;
  output_tokens: number | null;
  context_used_percent: number | null;
  duration_ms: number | null;
  attachments: string | null;
  /** Mensajes del usuario: el uuid con el que se encoló en el CLI. Null si nunca pasó por la cola (historial viejo). */
  command_uuid: string | null;
  /** Respuestas: qué mensajes encolados contesta, en el orden en que el usuario los mandó. Un turno puede contestar varios. */
  answers_command_uuids: string[] | null;
}

/** An attachment (image, document) about to be sent with a chat turn — filename + base64 content. */
export interface ChatAttachmentInput {
  filename: string;
  content_base64: string;
}

/**
 * Convierte una respuesta de error en un mensaje legible para el usuario (va a
 * un toast). El server manda JSON `{ message, limit }` en los errores que
 * controla —p.ej. 413 por adjuntos que superan el límite del body— y ahí
 * preferimos ese texto antes que el `HTTP 413` crudo. Fail-soft: si el body no
 * es ese JSON, cae a un genérico (y un 413 sin JSON igual se explica).
 */
function errorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed?.message === 'string' && parsed.message) return parsed.message;
  } catch {
    // body no era JSON — seguimos con los fallbacks de abajo
  }
  if (status === 413) return 'Los adjuntos superan el límite del servidor. Mandá menos fotos, o más chicas.';
  return `HTTP ${status}: ${body}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(errorMessage(res.status, body));
  }
  return res.json() as Promise<T>;
}

/** POST /api/chat/sessions — start a new conversation for a project */
export async function startChatSession(projectId: string): Promise<{ session_id: string }> {
  const res = await fetch('/api/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId }),
  });
  return handleResponse<{ session_id: string }>(res);
}

/**
 * POST /api/chat/sessions/:id/messages — queue a message.
 *
 * Returns 202 as soon as the engine accepted it, WITHOUT waiting for the
 * reply: Claude Code either folds the message into the turn it's running or
 * queues it right behind, so the user can keep typing. The answer, the queue
 * state and any failure arrive over the conversation's SSE stream
 * (see useChatStream), never in this response.
 */
export async function sendChatMessage(
  sessionId: string,
  message: string,
  attachments?: ChatAttachmentInput[],
): Promise<{ queued: boolean; session_id: string; command_uuid: string | null }> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      ...(attachments?.length ? { attachments } : {}),
    }),
  });
  return handleResponse<{ queued: boolean; session_id: string; command_uuid: string | null }>(res);
}

/**
 * POST /api/chat/sessions/:id/stop — cancel the turn in flight and, by
 * default, everything queued behind it. Pass cancelQueued=false to abort only
 * what's running and let the queue keep draining.
 */
export async function stopChatMessage(sessionId: string, cancelQueued = true): Promise<{ stopped: boolean }> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancel_queued: cancelQueued }),
  });
  return handleResponse<{ stopped: boolean }>(res);
}

/**
 * DELETE /api/chat/sessions/:id/queue/:commandUuid — saca UN mensaje de la cola.
 *
 * Mapea al `control_request` `cancel_async_message` del CLI. Verificado contra
 * el CLI real 2.1.220: el mensaje pasa de `queued` a `cancelled` sin ejecutarse
 * y el turno en curso sigue intacto. `cancelled: false` significa que ya había
 * salido de la cola (o nunca estuvo), y es un no-op benigno, no un error.
 *
 * OJO: el endpoint todavía NO existe en http-api — falta wirear
 * `cancelAsyncMessage()` en PersistentClaudeSession. Hasta entonces esto
 * devuelve 404 y la UI lo trata como un fallo de cancelación.
 */
export async function cancelQueuedMessage(
  sessionId: string,
  commandUuid: string,
): Promise<{ cancelled: boolean }> {
  const res = await fetch(
    `/api/chat/sessions/${encodeURIComponent(sessionId)}/queue/${encodeURIComponent(commandUuid)}`,
    { method: 'DELETE' },
  );
  return handleResponse<{ cancelled: boolean }>(res);
}

/**
 * POST /api/chat/sessions/:id/background-tasks/stop — detiene tareas en background.
 *
 * Sin `task_id` detiene todas. En el CLI `stop_task` es SIEMPRE por task_id (el
 * schema lo tiene requerido, no hay variante "todas"), así que "todas" se
 * resuelve del lado del server como N llamadas. No confundir con
 * `POST :id/stop`: ese manda `interrupt` y corta el TURNO, sin tocar estas
 * tareas — que justamente sobreviven al turno.
 *
 * OJO: el endpoint todavía NO existe en http-api.
 */
export async function stopBackgroundTask(
  sessionId: string,
  taskId?: string,
): Promise<{ stopped: boolean }> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/background-tasks/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskId ? { task_id: taskId } : {}),
  });
  return handleResponse<{ stopped: boolean }>(res);
}

/** GET /api/chat/sessions?project_id= — list conversations for a project */
export async function listChatSessions(projectId: string): Promise<ChatSession[]> {
  const res = await fetch(`/api/chat/sessions?project_id=${encodeURIComponent(projectId)}`);
  return handleResponse<ChatSession[]>(res);
}

/** GET /api/chat/sessions/:id/messages — full history of one conversation */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`);
  return handleResponse<ChatMessage[]>(res);
}

/** PATCH /api/chat/sessions/:id — rename a conversation */
export async function renameChatSession(sessionId: string, title: string): Promise<ChatSession> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return handleResponse<ChatSession>(res);
}

/**
 * PATCH /api/chat/sessions/:id/replica — mueve la conversación a otra réplica,
 * o de vuelta al root del proyecto con `null`.
 *
 * `null` es un valor con significado propio acá (volver a la base), así que se
 * manda siempre el campo: un body sin `replica_id` lo rechaza el backend en
 * vez de adivinar.
 *
 * El backend tira el proceso vivo de la conversación para que el turno
 * siguiente lo recree en el directorio nuevo — de ahí el `notice`, que trae el
 * aviso de que ese turno va a arrancar más lento. `moved: false` significa que
 * ya estaba ahí y no se pagó nada.
 */
export async function moveChatSessionToReplica(
  sessionId: string,
  replicaId: string | null,
): Promise<{ session: ChatSession; moved: boolean; process_disposed: boolean; notice?: string }> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/replica`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replica_id: replicaId }),
  });
  return handleResponse<{ session: ChatSession; moved: boolean; process_disposed: boolean; notice?: string }>(res);
}

/** DELETE /api/chat/sessions/:id — remove a conversation */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(errorMessage(res.status, body));
  }
}
