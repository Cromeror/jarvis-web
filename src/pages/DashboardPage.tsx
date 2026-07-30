import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listPipelineRuns } from '../lib/pipelines-api.js';
import type { PipelineRunSummary } from '../lib/pipelines-api.js';
import { listProjectReplicas } from '../lib/project-replicas-api.js';
import type { ProjectReplica } from '../lib/project-replicas-api.js';
import {
  listEnvironmentDefinitions,
  listAllEnvironmentRuns,
  runBelongsToEnvironment,
  deriveEnvironmentStatus,
  type EnvironmentRunSummary,
} from '../lib/environments-api.js';
import { CardProject } from '../components/ui/molecules/CardProject.js';
import { SectionCard } from '../components/ui/molecules/SectionCard.js';
import { Button2 } from '../components/ui/atoms/Button2.js';
import { FilterPopover } from '../components/ui/atoms/FilterPopover.js';
import { FilterIcon } from '../components/ui/atoms/FilterIcon.js';
import {
  RecentPipelinesTable2,
  type RecentPipelinesTable2Row,
} from '../components/ui/organisms/RecentPipelinesTable2.js';
import { InfrastructureTable, type InfrastructureTableRow } from '../components/ui/organisms/InfrastructureTable.js';
import type { BadgeStatus } from '../components/ui/atoms/Badge.js';

const STATUS_LABEL: Record<PipelineRunSummary['status'], string> = {
  running: 'Running',
  completed: 'Success',
  failed: 'Failed',
  cancelled: 'Detenido',
};

const STATUS_TONE: Record<PipelineRunSummary['status'], BadgeStatus> = {
  running: 'running',
  completed: 'success',
  failed: 'failed',
  cancelled: 'cancelled',
};

/** Estados de EnvironmentLifecycleStatus que cuentan como "ambiente activo" en el dot de InfrastructureTable. */
const ACTIVE_ENV_STATUSES = new Set(['running', 'checking', 'connected']);

/** "2m 45s" from a duration in milliseconds. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function runDurationMs(run: PipelineRunSummary): number | null {
  if (!run.finished_at) return null;
  return new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
}

function PlusIcon(): React.ReactElement {
  return (
    <svg className="block size-[13.5px] shrink-0" viewBox="0 0 13.5 13.5" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 6.75C13.5 6.89919 13.4407 7.04226 13.3352 7.14775C13.2298 7.25324 13.0867 7.3125 12.9375 7.3125H7.3125V12.9375C7.3125 13.0867 7.25324 13.2298 7.14775 13.3352C7.04226 13.4407 6.89919 13.5 6.75 13.5C6.60082 13.5 6.45774 13.4407 6.35225 13.3352C6.24676 13.2298 6.1875 13.0867 6.1875 12.9375V7.3125H0.5625C0.413316 7.3125 0.270242 7.25324 0.164753 7.14775C0.0592633 7.04226 0 6.89919 0 6.75C0 6.60082 0.0592633 6.45774 0.164753 6.35225C0.270242 6.24676 0.413316 6.1875 0.5625 6.1875H6.1875V0.5625C6.1875 0.413316 6.24676 0.270242 6.35225 0.164753C6.45774 0.0592633 6.60082 0 6.75 0C6.89919 0 7.04226 0.0592633 7.14775 0.164753C7.25324 0.270242 7.3125 0.413316 7.3125 0.5625V6.1875H12.9375C13.0867 6.1875 13.2298 6.24676 13.3352 6.35225C13.4407 6.45774 13.5 6.60082 13.5 6.75Z" />
    </svg>
  );
}

function ChevronDownIcon(): React.ReactElement {
  return (
    <svg className="block h-[6px] w-[11px] shrink-0" viewBox="0 0 11.0006 6.00067" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.854 0.854028L5.85403 5.85403C5.80759 5.90052 5.75245 5.9374 5.69175 5.96256C5.63105 5.98772 5.56599 6.00067 5.50028 6.00067C5.43457 6.00067 5.36951 5.98772 5.30881 5.96256C5.24811 5.9374 5.19296 5.90052 5.14653 5.85403L0.146528 0.854028C0.0527077 0.760208 0 0.63296 0 0.500278C0 0.367596 0.0527077 0.240348 0.146528 0.146528C0.240348 0.0527074 0.367596 0 0.500278 0C0.63296 0 0.760208 0.0527074 0.854028 0.146528L5.50028 4.7934L10.1465 0.146528C10.193 0.100073 10.2481 0.0632225 10.3088 0.0380812C10.3695 0.0129398 10.4346 0 10.5003 0C10.566 0 10.631 0.0129398 10.6917 0.0380812C10.7524 0.0632225 10.8076 0.100073 10.854 0.146528C10.9005 0.192983 10.9373 0.248133 10.9625 0.30883C10.9876 0.369526 11.0006 0.434581 11.0006 0.500278C11.0006 0.565975 10.9876 0.63103 10.9625 0.691726C10.9373 0.752423 10.9005 0.807573 10.854 0.854028Z" />
    </svg>
  );
}

/**
 * Dashboard: multi-project overview — project grid, infraestructura
 * (réplicas + ambientes) y recent pipeline runs, tema oscuro "DBoard V1.1.X"
 * (Figma node 6899:1729). REQ-1, REQ-11, SC-01, R8 — handles empty state
 * without crash.
 */
export function DashboardPage(): React.ReactElement {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
  const [replicasByProject, setReplicasByProject] = useState<Record<string, ProjectReplica[]>>({});
  const [envNamesByProject, setEnvNamesByProject] = useState<Record<string, string[]>>({});
  const [allEnvRuns, setAllEnvRuns] = useState<EnvironmentRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listProjects()
      .then(setProjects)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error loading projects');
      })
      .finally(() => setLoading(false));
  }, []);

  const projectIdsToLoad = projectFilter.length > 0 ? projectFilter : projects.map((p) => p.id);

  useEffect(() => {
    if (projectIdsToLoad.length === 0) {
      setRuns([]);
      return;
    }
    Promise.all(projectIdsToLoad.map((id) => listPipelineRuns(id)))
      .then((results) => setRuns(results.flat()))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error loading pipeline runs');
      });
  }, [projectIdsToLoad.join(',')]);

  useEffect(() => {
    if (projectIdsToLoad.length === 0) {
      setReplicasByProject({});
      setEnvNamesByProject({});
      return;
    }
    Promise.all(
      projectIdsToLoad.map((id) =>
        Promise.all([listProjectReplicas(id), listEnvironmentDefinitions(id)]).then(
          ([replicas, envNames]) => [id, replicas, envNames] as const,
        ),
      ),
    )
      .then((results) => {
        setReplicasByProject(Object.fromEntries(results.map(([id, replicas]) => [id, replicas])));
        setEnvNamesByProject(Object.fromEntries(results.map(([id, , envNames]) => [id, envNames])));
      })
      .catch(() => {
        /* best-effort — la tabla de infraestructura simplemente queda en 0/0 sin ambientes */
      });
    listAllEnvironmentRuns()
      .then(setAllEnvRuns)
      .catch(() => {
        /* best-effort — los dots de ambiente quedan todos inactivos */
      });
  }, [projectIdsToLoad.join(',')]);

  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectOptions = useMemo(() => projects.map((p) => ({ label: p.name, value: p.id })), [projects]);

  const visibleProjects = projectFilter.length > 0
    ? projects.filter((p) => projectFilter.includes(p.id))
    : projects;

  const recentRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [runs],
  );

  const pipelineRows: RecentPipelinesTable2Row[] = recentRuns.slice(0, 15).map((run) => {
    const ms = runDurationMs(run);
    return {
      id: run.id,
      name: run.name,
      project: projectNameById.get(run.project_id ?? '') ?? run.project_id ?? '',
      statusLabel: STATUS_LABEL[run.status],
      statusTone: STATUS_TONE[run.status],
      duration: ms !== null ? formatDuration(ms) : '—',
    };
  });

  const environmentsByProject = useMemo(() => {
    const result: Record<string, { name: string; active: boolean }[]> = {};
    for (const p of visibleProjects) {
      const envNames = envNamesByProject[p.id] ?? [];
      result[p.id] = envNames.map((name) => {
        const envRuns = allEnvRuns.filter((r) => r.project_id === p.id && runBelongsToEnvironment(r, name));
        return { name, active: ACTIVE_ENV_STATUSES.has(deriveEnvironmentStatus(envRuns)) };
      });
    }
    return result;
  }, [visibleProjects, envNamesByProject, allEnvRuns]);

  const infraRows: InfrastructureTableRow[] = visibleProjects.map((p) => {
    const replicas = replicasByProject[p.id] ?? [];
    return {
      id: p.id,
      project: p.name,
      activeReplicas: replicas.filter((r) => r.status === 'active').length,
      totalReplicas: replicas.length,
      environments: environmentsByProject[p.id] ?? [],
    };
  });

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto px-8 py-7">
        <div className="py-16 text-center text-sm text-[var(--card-text-secondary)]">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto px-8 py-7">
        <div className="py-16 text-center text-sm text-red-400">{error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto px-8 py-7">
        <div className="py-16 text-center text-sm text-[var(--card-text-secondary)]">
          <p>No projects found.</p>
          <p className="mt-2">
            Run <code>jarvis setup</code> to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-8 overflow-x-hidden overflow-y-auto px-8 py-7">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--card-text-primary)]">Proyectos</h1>
            <p className="text-sm text-[var(--card-text-secondary)]">
              {projects.length} project{projects.length !== 1 ? 's' : ''} conectados.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FilterPopover
              icon={<FilterIcon />}
              groups={[{ label: 'Proyectos', options: projectOptions, selected: projectFilter, onChange: setProjectFilter }]}
              variant="dark"
            />
            <Button2 label="Ver todos" variant="secondary" size="xs" />
            <Button2 label="Nuevo" variant="primary" size="xs" iconLeft={<PlusIcon />} iconRight={<ChevronDownIcon />} />
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {visibleProjects.map((p) => (
            <div key={p.id} className="h-[198px] w-[198px] shrink-0">
              <CardProject
                title={p.name}
                environments={environmentsByProject[p.id] ?? []}
                chatsCount={p.chats_count}
                recentChats={p.recent_chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }))}
                onClick={() => navigate(`/chat/${p.id}`)}
                className="h-full"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Infraestructura">
          <InfrastructureTable rows={infraRows} />
        </SectionCard>

        <SectionCard title="Recent Pipelines">
          {pipelineRows.length === 0 ? (
            <div className="rounded-[var(--table2-radius)] border border-[var(--table2-border)] bg-[var(--table2-bg)] py-16 text-center text-sm text-[var(--card-text-secondary)]">
              Todavía no hay corridas de pipelines.
            </div>
          ) : (
            <RecentPipelinesTable2 rows={pipelineRows} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
