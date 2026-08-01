/**
 * API client for the chat rail's notify module
 * (packages/http-api/src/notifications/notifications.controller.ts).
 *
 * Read-only by design: rows are written by the model through the
 * notify_focus_update / notify_event tools, never from the web-app.
 */

export type NotificationStatus = 'info' | 'success' | 'error' | 'warning';

/** Qué señala el evento — la UI lo convierte en navegación y, para `plan`, en acción inline. */
export type NotificationTargetKind = 'plan' | 'plan_run' | 'pipeline_run' | 'session';

export interface Notification {
  id: number;
  project_id: string | null;
  session_id: string | null;
  status: NotificationStatus;
  text: string;
  target_kind: NotificationTargetKind | null;
  target_id: string | null;
  /** Con valor = ya fue atendida; sale del Inbox pero sigue en el log. */
  read_at: string | null;
  created_at: string;
}

export interface SessionFocus {
  session_id: string;
  project_id: string | null;
  /** Title of the current focus — not the conversation's name. */
  title: string | null;
  summary: string;
  /** Plan the model proposed without creating it — no plan row exists for it. */
  suggested_plan_title: string | null;
  updated_at: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/notifications — newest first. One of projectId/sessionId is required for non-superadmins. */
export async function listNotifications(params: {
  projectId?: string | null;
  sessionId?: string | null;
  status?: NotificationStatus[];
  /** true = solo las que siguen esperando atención. */
  unread?: boolean;
  limit?: number;
}): Promise<Notification[]> {
  const query = new URLSearchParams();
  if (params.projectId) query.set('project_id', params.projectId);
  if (params.sessionId) query.set('session_id', params.sessionId);
  if (params.status?.length) query.set('status', params.status.join(','));
  if (params.unread) query.set('unread', 'true');
  if (params.limit) query.set('limit', String(params.limit));

  const res = await fetch(`/api/notifications?${query.toString()}`);
  const body = await handleResponse<{ notifications: Notification[] }>(res);
  return body.notifications;
}

/**
 * POST /api/notifications/:id/read — la saca del Inbox. No borra nada: el
 * evento queda en el log y sigue visible en LIVE. Única escritura que hace la
 * web-app sobre este módulo; el contenido siempre lo crea el modelo.
 */
export async function markNotificationRead(id: number): Promise<Notification> {
  const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  const body = await handleResponse<{ notification: Notification }>(res);
  return body.notification;
}

/** GET /api/chat/:id/focus — null when the conversation never reported a focus. */
export async function getSessionFocus(sessionId: string): Promise<SessionFocus | null> {
  const res = await fetch(`/api/chat/${encodeURIComponent(sessionId)}/focus`);
  const body = await handleResponse<{ focus: SessionFocus | null }>(res);
  return body.focus;
}
