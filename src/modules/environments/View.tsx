import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ModuleViewProps } from '../registry.js';
import {
  listEnvironmentDefinitions,
  listEnvironmentRuns,
  getEnvironmentDefinition,
  createEnvironmentDefinition,
  updateEnvironmentDefinition,
  deleteEnvironmentDefinition,
  runEnvironmentByName,
  shutdownEnvironmentByName,
  checkEnvironmentByName,
  runBelongsToEnvironment,
  NEW_ENVIRONMENT_TEMPLATE,
} from '../../lib/environments-api.js';
import type { EnvironmentRunSummary } from '../../lib/environments-api.js';
import { listProjectReplicas, ROOT_REPLICA } from '../../lib/project-replicas-api.js';
import type { ProjectReplica } from '../../lib/project-replicas-api.js';
import { EnvironmentDetailPanel } from '../../components/Environments/EnvironmentDetailPanel.js';
import { Toast, useToast } from '../../components/ui/atoms/Toast.js';
import { Button } from '../../components/ui/atoms/Button.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';

/**
 * ENTORNOS (`MOD-0002`), en el riel de quien lo tiene asignado: los entornos
 * del ESPACIO ACTIVO, y nada más.
 *
 * Es la diferencia con la página del operador (`/environments`), que junta los
 * de todos los proyectos. Acá el espacio no se elige: es el que la persona
 * tiene seleccionado arriba del riel y llega como `projectId`. Una persona que
 * está en varios espacios ve los del que eligió; al cambiar de espacio, la
 * vista suelta lo que tenía abierto y carga los del nuevo.
 *
 * Quién puede qué lo decide el backend, no esta vista: ver pide `MOD-0002:read`,
 * crear, editar y borrar `:write`, y levantar o apagar `:run`, siempre contra
 * este espacio. Un 403 llega como un aviso, no se esconde.
 */
export function View({ projectId }: ModuleViewProps): React.ReactElement {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const { proyectos } = useActiveProject();
  const nombreDelEspacio = proyectos.find((p) => p.id === projectId)?.name ?? projectId;

  const [names, setNames] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<EnvironmentRunSummary[]>([]);
  const [replicas, setReplicas] = useState<ProjectReplica[]>([]);
  const [replicaId, setReplicaId] = useState<string>(ROOT_REPLICA);
  /** En mobile la lista y el detalle no entran juntos: se ve uno u otro. */
  const [verLista, setVerLista] = useState(true);
  // El API espera `undefined`/ausente para "root", no el sentinel de UI.
  const apiReplicaId = replicaId === ROOT_REPLICA ? undefined : replicaId;

  const aviso = useCallback(
    (err: unknown, fallback: string) => addToast(err instanceof Error ? err.message : fallback, 'error'),
    [addToast],
  );

  const cargarLista = useCallback(() => {
    setCargando(true);
    listEnvironmentDefinitions(projectId)
      .then(setNames)
      .catch((err: unknown) => {
        setNames([]);
        aviso(err, 'Error al cargar los entornos');
      })
      .finally(() => setCargando(false));
  }, [projectId, aviso]);

  /* Cambiar de espacio es otra lista: lo abierto era de otro espacio y no
     puede quedar a la vista (ni guardarse contra el nuevo). */
  useEffect(() => {
    setActive(null);
    setContent('');
    setSavedContent('');
    setRuns([]);
    setReplicas([]);
    setReplicaId(ROOT_REPLICA);
    setVerLista(true);
    cargarLista();
    listProjectReplicas(projectId)
      .then(setReplicas)
      .catch(() => setReplicas([]));
  }, [projectId, cargarLista]);

  const cargarRuns = useCallback(
    (name: string, replica: string) => {
      listEnvironmentRuns(projectId, replica === ROOT_REPLICA ? undefined : replica)
        .then((all) => setRuns(all.filter((r) => runBelongsToEnvironment(r, name))))
        .catch(() => setRuns([]));
    },
    [projectId],
  );

  const elegir = useCallback(
    (name: string) => {
      setActive(name);
      setReplicaId(ROOT_REPLICA);
      setVerLista(false);
      getEnvironmentDefinition(projectId, name)
        .then((def) => {
          setContent(def.content);
          setSavedContent(def.content);
        })
        .catch((err: unknown) => aviso(err, 'Error al cargar el entorno'));
      cargarRuns(name, ROOT_REPLICA);
    },
    [projectId, aviso, cargarRuns],
  );

  async function crear(): Promise<void> {
    const name = prompt('Nombre del nuevo entorno (sin extensión):');
    if (!name) return;
    try {
      await createEnvironmentDefinition(projectId, name, NEW_ENVIRONMENT_TEMPLATE);
      cargarLista();
      setActive(name);
      setContent(NEW_ENVIRONMENT_TEMPLATE);
      setSavedContent(NEW_ENVIRONMENT_TEMPLATE);
      setRuns([]);
      setVerLista(false);
    } catch (err) {
      aviso(err, 'Error al crear el entorno');
    }
  }

  async function guardar(): Promise<void> {
    if (!active) return;
    setSaving(true);
    try {
      await updateEnvironmentDefinition(projectId, active, content);
      setSavedContent(content);
      addToast('Entorno guardado', 'success');
    } catch (err) {
      aviso(err, 'Error al guardar el entorno');
    } finally {
      setSaving(false);
    }
  }

  async function borrar(): Promise<void> {
    if (!active) return;
    if (!confirm(`¿Eliminar el entorno "${active}"?`)) return;
    try {
      await deleteEnvironmentDefinition(projectId, active);
      setActive(null);
      setContent('');
      setSavedContent('');
      setRuns([]);
      setVerLista(true);
      cargarLista();
    } catch (err) {
      aviso(err, 'Error al eliminar el entorno');
    }
  }

  /** Levantar, apagar y verificar son lo mismo para la vista: lanzar y abrir la corrida. */
  async function lanzar(
    accion: typeof runEnvironmentByName,
    fallback: string,
  ): Promise<void> {
    if (!active) return;
    setRunning(true);
    try {
      const { run_id } = await accion(projectId, active, apiReplicaId);
      navigate(`/pipeline/${run_id}`);
    } catch (err) {
      aviso(err, fallback);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-border">
      <Toast toasts={toasts} onDismiss={removeToast} />

      <aside
        className={`${verLista ? 'flex' : 'hidden'} w-full shrink-0 flex-col border-r border-border bg-card md:flex md:w-64`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Entornos</span>
          <Button variant="outline" onClick={() => void crear()}>
            Nuevo
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {cargando ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Cargando…</p>
          ) : names.length === 0 ? (
            /* El vacío dice qué hacer, no "no hay filas": un espacio sin
               entornos todavía no declaró cómo se levanta. */
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Este espacio todavía no tiene entornos. Creá uno para declarar cómo se levanta.
            </p>
          ) : (
            names.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => elegir(name)}
                className={`w-full truncate rounded px-2 py-1.5 text-left text-sm ${
                  name === active ? 'bg-primary/15 text-foreground' : 'text-secondary-foreground hover:bg-accent'
                }`}
              >
                {name}
              </button>
            ))
          )}
        </div>
      </aside>

      <div className={`${verLista ? 'hidden' : 'flex'} min-w-0 flex-1 md:flex`}>
        {active ? (
          <EnvironmentDetailPanel
            projectName={nombreDelEspacio}
            name={active}
            content={content}
            onChangeContent={setContent}
            dirty={content !== savedContent}
            saving={saving}
            onSave={() => void guardar()}
            onDelete={() => void borrar()}
            running={running}
            onRun={() => void lanzar(runEnvironmentByName, 'Error al levantar el entorno')}
            onShutdown={() => void lanzar(shutdownEnvironmentByName, 'Error al apagar el entorno')}
            onCheck={() => void lanzar(checkEnvironmentByName, 'Error al verificar el entorno')}
            replicas={replicas}
            replicaId={replicaId}
            onChangeReplica={(next) => {
              setReplicaId(next);
              cargarRuns(active, next);
            }}
            runs={runs}
            onOpenRun={(runId) => navigate(`/pipeline/${runId}`)}
            onBackToList={() => setVerLista(true)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            Elegí un entorno de la lista, o creá uno nuevo.
          </div>
        )}
      </div>
    </div>
  );
}
