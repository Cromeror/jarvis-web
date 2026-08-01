import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionFocus, listNotifications, type Notification, type SessionFocus } from '../lib/notifications-api.js';
import { listPlans, listPlansForSession, type PlanSummary } from '../lib/plans-api.js';

/**
 * Polling instead of SSE, unlike usePipelineEvents/usePlanRunEvents: those
 * follow ONE run that the server drives step by step, while this is ambient
 * state for whatever conversation is open — and the rail's own sources already
 * arrive by different routes (focus, notifications, plans). A 10s poll of a few
 * cheap reads keeps that simple and costs no open connection per browser tab.
 * Worth revisiting if the Live queue ever needs sub-second latency.
 */
const POLL_INTERVAL_MS = 10_000;

/** Enough to fill the Live queue without paging. */
const LIVE_LIMIT = 30;

/** The Inbox shows a few rows and summarises the rest, so it never needs the full backlog. */
const INBOX_LIMIT = 20;

export interface RailFocusData {
  focus: SessionFocus | null;
  /** Unread `warning` rows — what the ATENCIÓN section shows. */
  inbox: Notification[];
  /** Recent events regardless of read state — the LIVE feed. */
  liveEvents: Notification[];
  /** Most recent plan of this conversation, or null — decides the Focus card's variant. */
  sessionPlan: PlanSummary | null;
  /** Draft plans of the project, by id: lets an Inbox row offer "Aprobar" inline. */
  draftPlanIds: Set<string>;
  /**
   * When this snapshot was taken. Exposed so relative labels ("hace 3s") are
   * recomputed on every refresh instead of freezing at first render.
   */
  now: number;
  /** Forces a reload — used after dismissing or resolving a row, so it disappears at once. */
  refresh: () => void;
}

const EMPTY = {
  focus: null as SessionFocus | null,
  inbox: [] as Notification[],
  liveEvents: [] as Notification[],
  sessionPlan: null as PlanSummary | null,
  draftPlanIds: new Set<string>(),
};

export function useRailFocus(sessionId: string | null, projectId: string | null): RailFocusData {
  const [data, setData] = useState(EMPTY);
  const [now, setNow] = useState(() => Date.now());
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  // Kept in a ref so the polling effect doesn't restart on every refresh() call.
  const tokenRef = useRef(reloadToken);
  tokenRef.current = reloadToken;

  useEffect(() => {
    if (!sessionId && !projectId) {
      setData(EMPTY);
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      try {
        // Scoped by PROJECT, not by session: the Inbox is defined by origin —
        // whatever comes from a process running in parallel to the conversation
        // you have open, which is mostly other sessions. Session is only the
        // fallback scope for a conversation with no project (the query needs one).
        const scope = projectId ? { projectId } : { sessionId };

        const [focus, inbox, liveEvents, plans, draftPlans] = await Promise.all([
          sessionId ? getSessionFocus(sessionId) : Promise.resolve(null),
          listNotifications({ ...scope, status: ['warning'], unread: true, limit: INBOX_LIMIT }),
          listNotifications({ ...scope, limit: LIVE_LIMIT }),
          sessionId ? listPlansForSession(sessionId) : Promise.resolve([]),
          // Only to decide which Inbox rows can be approved in place; filtered
          // server-side to drafts so this stays small even in old projects.
          projectId ? listPlans(projectId, 'draft') : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setData({
          focus,
          inbox,
          liveEvents,
          sessionPlan: plans[0] ?? null,
          draftPlanIds: new Set(draftPlans.map((p) => p.id)),
        });
        setNow(Date.now());
      } catch {
        // The rail is ambient information: a failed refresh keeps the previous
        // snapshot rather than blanking the panel or surfacing an error toast.
      }
    }

    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId, projectId, reloadToken]);

  return { ...data, now, refresh };
}
