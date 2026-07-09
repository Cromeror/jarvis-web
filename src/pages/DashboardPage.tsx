import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { ProjectCard } from '../components/ui/molecules/ProjectCard.js';

/**
 * Dashboard: grid of project cards.
 * REQ-1, REQ-11, SC-01, R8 — handles empty state without crash.
 * T9.
 */
export function DashboardPage(): React.ReactElement {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
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

  if (loading) {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-6">
        <div className="py-16 text-center text-sm text-slate-400">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-6">
        <div className="py-16 text-center text-sm text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Jarvis Projects</h1>
        <span className="text-sm text-slate-400">
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </span>
      </header>

      {projects.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          <p>No projects found.</p>
          <p className="mt-2">
            Run <code>jarvis setup</code> to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => navigate(`/chat/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
