import React, { useState } from 'react';
import { ROOT_REPLICA, type ProjectReplica } from '../../lib/project-replicas-api.js';
import { activeReplicas } from '../../lib/session-workspace.js';
import { Button } from '../ui/atoms/Button.js';
import { ReplicaChoiceList } from '../ui/molecules/ReplicaChoiceList.js';

interface SessionWorkspaceDialogProps {
  sessionTitle: string;
  /** Réplicas del proyecto de la conversación, tal como vinieron del backend. */
  replicas: ProjectReplica[];
  /** Dónde corre hoy: `null` = la base. */
  currentReplicaId: string | null;
  onCancel: () => void;
  onConfirm: (replicaId: string | null) => void;
  moving?: boolean;
}

/**
 * "Trabajar en otra réplica" — mover ESTA conversación a otro working tree.
 *
 * Deliberadamente no existe al crear la conversación: ahí el default es la
 * base y preguntar obligaría a decidir en el peor momento, antes de saber qué
 * se va a hacer. La elección aparece cuando el usuario ya tiene el problema
 * enfrente y puede contestarla.
 *
 * Tampoco ofrece crear una réplica, a diferencia de PlanLaunchDialog: crear un
 * worktree tarda y cuesta disco, y meterlo en el camino de "movete allá"
 * convierte una acción de un click en una espera. Las réplicas se crean donde
 * se administran.
 */
export function SessionWorkspaceDialog({
  sessionTitle,
  replicas,
  currentReplicaId,
  onCancel,
  onConfirm,
  moving = false,
}: SessionWorkspaceDialogProps): React.ReactElement {
  const current = currentReplicaId ?? ROOT_REPLICA;
  const [selected, setSelected] = useState<string>(current);

  const usable = activeReplicas(replicas);
  // La réplica actual entra a la lista aunque ya no esté 'active': si no, una
  // conversación cuya réplica se rompió abriría este diálogo sin poder ver
  // dónde está parada, y "actual" no marcaría nada.
  const options = currentReplicaId && !usable.some((r) => r.id === currentReplicaId)
    ? [...usable, ...replicas.filter((r) => r.id === currentReplicaId)]
    : usable;

  const changed = selected !== current;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !moving) onCancel();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-base font-semibold text-slate-900">¿Dónde trabaja esta conversación?</h2>
          <p className="mt-1 text-sm text-slate-500">{sessionTitle}</p>
        </div>

        <ReplicaChoiceList
          replicas={options}
          value={selected}
          onChange={setSelected}
          currentValue={current}
          rootHint="El directorio principal del proyecto — compartido con las demás conversaciones que estén ahí."
        />

        {changed && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Al moverla se reinicia el proceso: <strong>el próximo mensaje va a tardar más en arrancar</strong>.
            No se pierde nada de la conversación — se retoma donde está.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="neutral" onClick={onCancel} disabled={moving}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(selected === ROOT_REPLICA ? null : selected)}
            disabled={moving || !changed}
          >
            {moving ? 'Moviendo…' : 'Mover'}
          </Button>
        </div>
      </div>
    </div>
  );
}
