import { useEffect, useState } from 'react';
import type { LoginAttempt, LoginAttemptStatus } from '../lib/login-api.js';
import { apiUrl } from '../lib/api-origin.js';

interface LoginUpdatedEvent {
  event: 'login_updated';
  attemptId: string;
  type: 'url' | 'awaiting_code' | 'log' | 'success' | 'error';
  data: string;
}

interface LoginFinishedEvent {
  event: 'login_finished';
  status: 'success' | 'error';
}

type LoginSseEvent = LoginUpdatedEvent | LoginFinishedEvent;

const TERMINAL_STATUSES: LoginAttemptStatus[] = ['success', 'failed', 'aborted'];

/**
 * Subscribes to real-time progress for a Claude Code login attempt via SSE
 * (GET /api/login/:id/events) — mirrors usePipelineEvents.ts.
 */
export function useLoginEvents(attemptId: string | null) {
  const [attempt, setAttempt] = useState<LoginAttempt | null>(null);

  useEffect(() => {
    if (!attemptId) { setAttempt(null); return; }

    let cancelled = false;
    setAttempt(null);

    fetch(`/api/login/${attemptId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { attempt: LoginAttempt } | null) => {
        if (cancelled || !data) return;
        setAttempt(data.attempt);
      })
      .catch(() => { /* snapshot best-effort — SSE will still fill in state */ });

    const es = new EventSource(apiUrl(`/api/login/${attemptId}/events`));
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as LoginSseEvent;
        if (data.event === 'login_updated') {
          setAttempt((prev) => {
            const base: LoginAttempt = prev ?? {
              id: attemptId,
              status: 'starting',
              oauth_url: null,
              prompt_text: null,
              error: null,
            };
            if (data.type === 'url') return { ...base, status: 'awaiting_browser', oauth_url: data.data };
            if (data.type === 'awaiting_code') return { ...base, status: 'awaiting_code', prompt_text: data.data };
            if (data.type === 'success') return { ...base, status: 'success' };
            if (data.type === 'error') return { ...base, status: 'failed', error: data.data };
            return base;
          });
        } else if (data.event === 'login_finished') {
          es.close();
        }
      } catch { /* ignore malformed events */ }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [attemptId]);

  const isFinished = attempt ? TERMINAL_STATUSES.includes(attempt.status) : false;

  return { attempt, isFinished };
}
