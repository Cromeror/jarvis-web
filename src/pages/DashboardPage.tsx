import React, { useEffect, useState } from 'react';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';

interface DashboardPageProps {
  onNavigateToProject: (projectId: string) => void;
  onNavigateToContextGraph?: () => void;
}

/**
 * Dashboard: grid of project cards.
 * REQ-1, REQ-11, SC-01, R8 — handles empty state without crash.
 * T9.
 */
export function DashboardPage({ onNavigateToProject, onNavigateToContextGraph }: DashboardPageProps): React.ReactElement {
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
      <div className="dashboard-page">
        <div className="dashboard-loading">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Jarvis Projects</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onNavigateToContextGraph && (
            <button className="dashboard-graph-link" onClick={onNavigateToContextGraph}>
              ◉ Grafo de conocimiento
            </button>
          )}
          <span className="dashboard-count">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="dashboard-empty">
          <p>No projects found.</p>
          <p className="dashboard-empty-hint">Run <code>jarvis setup</code> to get started.</p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {projects.map((p) => (
            <button
              key={p.id}
              className="project-card"
              onClick={() => onNavigateToProject(p.id)}
            >
              <div className="project-card-header">
                <span className="project-card-id">{p.id}</span>
                <span className={`project-card-status status-${p.status}`}>{p.status}</span>
              </div>
              <div className="project-card-name">{p.name}</div>
              {p.description && (
                <div className="project-card-description">{p.description}</div>
              )}
              <div className="project-card-meta">
                <span>{p.integrations_count} integration{p.integrations_count !== 1 ? 's' : ''}</span>
                <span>{p.skills_count} skill{p.skills_count !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
