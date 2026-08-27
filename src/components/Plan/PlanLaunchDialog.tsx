import React, { useEffect, useState } from 'react';
import {
  listProjectReplicas,
  createProjectReplica,
  ROOT_REPLICA,
  type ProjectReplica,
} from '../../lib/project-replicas-api.js';
import { Button } from '../ui/atoms/Button.js';
import { Spinner } from '../ui/atoms/Spinner.js';
import { ReplicaChoiceList } from '../ui/molecules/ReplicaChoiceList.js';

interface PlanLaunchDialogProps {
  planTitle: string;
  /** Proyecto del plan — null para un plan sin proyecto, que solo puede correr contra el cwd del server. */
  projectId: string | null;
  onCancel: () => void;
  /** `replicaId` undefined = el root_path del proyecto. */
  onConfirm: (replicaId?: string) => void;
}

/**
 * "¿Dónde corre este plan?" — el paso que faltaba entre apretar Ejecutar y que
 * la corrida arranque.
 *
 * El default es el root del proyecto, o sea exactamente lo que pasaba antes de
 * que este diálogo existiera. Elegir una réplica es lo único que hace que una
 * corrida y el chat del mismo proyecto no puedan pisarse los archivos: los dos
 * carriles ya tienen procesos separados, pero un working tree compartido sigue
 * siendo compartido.
 *
 * La réplica NO se borra al terminar la corrida: los cambios quedan en su
 * worktree/branch para revisarlos. Se borra desde donde se administran las
 * réplicas, no acá.
 */
export function PlanLaunchDialog({
  planTitle,
  projectId,
  onCancel,
  onConfirm,
}: PlanLaunchDialogProps): React.ReactElement {
  const [replicas, setReplicas] = useState<ProjectReplica[]>([]);
  const [loading, setLoading] = useState(!!projectId);
  const [selected, setSelected] = useState<string>(ROOT_REPLICA);
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    listProjectReplicas(projectId)
      .then((all) => {
        if (cancelled) return;
        // Una réplica a medio crear o fallada no es un destino válido: el
        // runner la trata como ausente y caería al root sin avisar.
        setReplicas(all.filter((r) => r.status === 'active'));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No pude listar las réplicas');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleCreate(): Promise<void> {
    const slug = newSlug.trim();
    if (!projectId || !slug) return;
    setCreating(true);
    setError(null);
    try {
      const replica = await createProjectReplica(projectId, slug);
      setReplicas((prev) => [...prev, replica]);
      setSelected(replica.id);
      setNewSlug('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude crear la réplica');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-base font-semibold text-slate-900">¿Dónde corre el plan?</h2>
          <p className="mt-1 text-sm text-slate-500">{planTitle}</p>
        </div>

        {!projectId && (
          <p className="text-sm text-slate-500">
            Este plan no tiene proyecto, así que corre contra el directorio del servidor.
          </p>
        )}

        {projectId && (loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Buscando réplicas…
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ReplicaChoiceList
              replicas={replicas}
              value={selected}
              onChange={setSelected}
              rootHint="Mismo working tree que el chat — si los dos editan el mismo archivo a la vez, se pisan."
            />

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="slug de una réplica nueva"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                disabled={creating}
              />
              <Button variant="outlined" onClick={() => void handleCreate()} disabled={creating || !newSlug.trim()}>
                {creating ? 'Creando…' : 'Crear'}
              </Button>
            </div>
            {creating && (
              <p className="text-xs text-slate-500">
                Creando el worktree y corriendo el init hook — puede tardar.
              </p>
            )}
          </div>
        ))}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="neutral" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(selected === ROOT_REPLICA ? undefined : selected)}
            disabled={creating}
          >
            Ejecutar
          </Button>
        </div>
      </div>
    </div>
  );
}
