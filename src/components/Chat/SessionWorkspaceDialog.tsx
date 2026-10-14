import React, { useState } from 'react';
import { ROOT_REPLICA, type ProjectReplica } from '../../lib/project-replicas-api.js';
import { activeReplicas } from '../../lib/session-workspace.js';
import { Button } from '../ui/atoms/Button.js';
import { Dialogo } from '../ui/Dialogo.js';
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
    <Dialogo
      abierto
      // Mientras se mueve no se cierra: el pedido ya salió y cerrar no lo frena.
      onCerrar={() => {
        if (!moving) onCancel();
      }}
      titulo="¿Dónde trabaja esta conversación?"
      descripcion={sessionTitle}
      ancho={448}
      pie={
        <>
          <Button variant="outline" onClick={onCancel} disabled={moving}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(selected === ROOT_REPLICA ? null : selected)}
            disabled={moving || !changed}
          >
            {moving ? 'Moviendo…' : 'Mover'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ReplicaChoiceList
          replicas={options}
          value={selected}
          onChange={setSelected}
          currentValue={current}
          rootHint="El directorio principal del proyecto — compartido con las demás conversaciones que estén ahí."
        />

        {changed && (
          <p className="rounded-[var(--sw-r-md)] bg-[var(--sw-warning-bg)] p-3 text-xs text-[var(--sw-on-warning)]">
            Al moverla se reinicia el proceso: <strong>el próximo mensaje va a tardar más en arrancar</strong>.
            No se pierde nada de la conversación — se retoma donde está.
          </p>
        )}
      </div>
    </Dialogo>
  );
}
