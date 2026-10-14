import React, { useEffect, useState } from 'react';
import {
  listProjectReplicas,
  createProjectReplica,
  ROOT_REPLICA,
  type ProjectReplica,
} from '../../lib/project-replicas-api.js';
import { Button } from '../ui/atoms/Button.js';
import { Dialogo } from '../ui/Dialogo.js';
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

  /* EL MODAL DEL SISTEMA (`Dialogo`) y no un overlay propio: aquel era una
     tarjeta blanca también en oscuro y vivía en la capa de `z-index`, así que
     abierto desde el modal del plan —que ya está en la capa superior— quedaba
     debajo. */
  return (
    <Dialogo
      abierto
      onCerrar={onCancel}
      titulo="¿Dónde corre el plan?"
      descripcion={planTitle}
      ancho={448}
      pie={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(selected === ROOT_REPLICA ? undefined : selected)} disabled={creating}>
            Ejecutar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {!projectId && (
          <p className="text-muted-foreground">
            Este plan no tiene proyecto, así que corre contra el directorio del servidor.
          </p>
        )}

        {projectId &&
          (loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
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
                  className="input min-w-0 flex-1"
                  disabled={creating}
                />
                <Button variant="outline" onClick={() => void handleCreate()} disabled={creating || !newSlug.trim()}>
                  {creating ? 'Creando…' : 'Crear'}
                </Button>
              </div>
              {creating && (
                <p className="text-xs text-muted-foreground">Creando el worktree y corriendo el init hook — puede tardar.</p>
              )}
            </div>
          ))}

        {error && <p className="text-[var(--sw-error)]">{error}</p>}
      </div>
    </Dialogo>
  );
}
