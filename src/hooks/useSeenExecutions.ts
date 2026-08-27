import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'jarvis:rail-seen-executions:';

/**
 * Tope de ids recordados por proyecto. Sin él la lista crece para siempre en
 * localStorage por algo que solo importa mientras la ejecución sigue en el
 * rail; se descartan los más viejos, y un plan olvidado vuelve a contar como
 * no visto (fallar hacia "mostrarlo" es el lado seguro).
 */
const MAX_REMEMBERED = 50;

function storageKey(projectId: string): string {
  return STORAGE_PREFIX + projectId;
}

function read(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export interface SeenExecutions {
  /** Ids ya vistos — lo que baja la prioridad de un `failed` en el rail. */
  seenIds: ReadonlySet<string>;
  markSeen: (planId: string) => void;
}

/**
 * Qué ejecuciones ya miró el usuario, por proyecto y persistido en
 * localStorage (mismo patrón best-effort que useCollapsible: si localStorage
 * falla, el rail sigue funcionando y simplemente no recuerda).
 *
 * Es estado de cliente y no una columna en `plans` a propósito: "lo miré" es
 * de esta persona en este browser, no del plan, y así no hace falta migración
 * ni un endpoint nuevo para una señal que solo ordena filas. Se marca al abrir
 * el detalle, sin botón aparte.
 */
export function useSeenExecutions(projectId: string | null): SeenExecutions {
  const [seenIds, setSeenIds] = useState<ReadonlySet<string>>(() => new Set<string>());

  useEffect(() => {
    setSeenIds(new Set(projectId ? read(projectId) : []));
  }, [projectId]);

  const markSeen = useCallback(
    (planId: string) => {
      if (!projectId) return;
      setSeenIds((prev) => {
        if (prev.has(planId)) return prev;
        // El más reciente al final: es el orden en que se descarta al recortar.
        const next = [...prev, planId].slice(-MAX_REMEMBERED);
        try {
          localStorage.setItem(storageKey(projectId), JSON.stringify(next));
        } catch {
          /* best-effort — el marcado simplemente no persiste */
        }
        return new Set(next);
      });
    },
    [projectId],
  );

  return { seenIds, markSeen };
}
