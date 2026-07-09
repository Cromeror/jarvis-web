import React from 'react';
import type { ProjectSummary } from '../../../lib/projects-api.js';

interface ProjectCardProps {
  project: ProjectSummary;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps): React.ReactElement {
  const isActive = project.status === 'active';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs text-slate-400">{project.id}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {project.status}
        </span>
      </div>
      <div className="truncate text-sm font-semibold text-slate-900">{project.name}</div>
      {project.description && (
        <div className="line-clamp-2 text-sm text-slate-500">{project.description}</div>
      )}
      <div className="flex gap-3 text-xs text-slate-400">
        <span>
          {project.integrations_count} integration{project.integrations_count !== 1 ? 's' : ''}
        </span>
        <span>
          {project.skills_count} skill{project.skills_count !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  );
}
