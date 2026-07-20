import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listPipelineRuns } from '../lib/pipelines-api.js';
import type { PipelineRunSummary } from '../lib/pipelines-api.js';
import { ProjectCard } from '../components/ui/molecules/ProjectCard.js';
import { FilterPopover } from '../components/ui/atoms/FilterPopover.js';
import { FilterIcon } from '../components/ui/atoms/FilterIcon.js';
import { StatusBadge, type StatusBadgeTone } from '../components/ui/atoms/StatusBadge.js';
import { DataTable, type DataTableColumn } from '../components/ui/organisms/DataTable.js';

const STATUS_LABEL: Record<PipelineRunSummary['status'], string> = {
  running: 'Running',
  completed: 'Success',
  failed: 'Failed',
  cancelled: 'Detenido',
};

const STATUS_TONE: Record<PipelineRunSummary['status'], StatusBadgeTone> = {
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

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

/**
 * Dashboard: multi-project overview — project grid and recent pipeline runs
 * combined across every project (or a filtered subset).
 * REQ-1, REQ-11, SC-01, R8 — handles empty state without crash.
 */
export function DashboardPage(): React.ReactElement {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [runs, setRuns] = useState<PipelineRunSummary[]>([]);
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

  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectOptions = useMemo(() => projects.map((p) => ({ label: p.name, value: p.id })), [projects]);

  const visibleProjects = projectFilter.length > 0
    ? projects.filter((p) => projectFilter.includes(p.id))
    : projects;

  const recentRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [runs],
  );

  const columns: Array<DataTableColumn<PipelineRunSummary>> = [
    {
      key: 'name',
      header: 'Pipeline',
      render: (run) => (
        <div>
          <div className="text-sm font-semibold text-slate-800">{run.name}</div>
          <div className="text-xs text-slate-400">{projectNameById.get(run.project_id ?? '') ?? run.project_id}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (run) => <StatusBadge label={STATUS_LABEL[run.status]} tone={STATUS_TONE[run.status]} />,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (run) => {
        const ms = runDurationMs(run);
        return <span className="font-mono text-sm text-slate-500">{ms !== null ? formatDuration(ms) : '—'}</span>;
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto bg-slate-50 p-6">
        <div className="py-16 text-center text-sm text-slate-400">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto bg-slate-50 p-6">
        <div className="py-16 text-center text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto bg-slate-50 p-6">
        <div className="py-16 text-center text-sm text-slate-400">
          <p>No projects found.</p>
          <p className="mt-2">
            Run <code>jarvis setup</code> to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto bg-slate-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">
            {projects.length} project{projects.length !== 1 ? 's' : ''} conectados.
          </p>
        </div>
        <FilterPopover
          icon={<FilterIcon />}
          groups={[{ label: 'Proyectos', options: projectOptions, selected: projectFilter, onChange: setProjectFilter }]}
        />
      </header>

      <h2 className="mb-4 text-lg font-semibold text-slate-900">Proyectos</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-4">
        {visibleProjects.map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => navigate(`/chat/${p.id}`)} />
        ))}
      </div>

      <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent Pipelines</h2>

      {recentRuns.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
          Todavía no hay corridas de pipelines.
        </div>
      ) : (
        <DataTable columns={columns} rows={recentRuns.slice(0, 15)} getRowKey={(run) => run.id} />
      )}
    </div>
  );
}
