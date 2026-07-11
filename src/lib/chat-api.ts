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
}

/** An attachment (image, document) about to be sent with a chat turn — filename + base64 content. */
export interface ChatAttachmentInput {
  filename: string;
  content_base64: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
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

/** POST /api/chat/sessions/:id/messages — send a message, run one turn */
export async function sendChatMessage(
  sessionId: string,
  message: string,
  attachments?: ChatAttachmentInput[],
): Promise<{
  text: string;
  session_id: string;
  input_tokens?: number;
  output_tokens?: number;
  context_used_percent?: number;
  duration_ms?: number;
}> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attachments?.length ? { message, attachments } : { message }),
  });
  return handleResponse<{
    text: string;
    session_id: string;
    input_tokens?: number;
    output_tokens?: number;
    context_used_percent?: number;
    duration_ms?: number;
  }>(res);
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

/** DELETE /api/chat/sessions/:id — remove a conversation */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}
