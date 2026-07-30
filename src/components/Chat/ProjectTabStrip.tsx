import React, { useMemo } from 'react';
import type { ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { Tab } from '../ui/atoms/Tab.js';

interface ProjectTabStripProps {
  sessions: ChatSession[];
  projects: ProjectSummary[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}

/**
 * Un tab por proyecto con al menos una conversación, ordenados por actividad
 * más reciente primero. Clickear un tab salta a la conversación más reciente
 * de ese proyecto — el puntero se recalcula cada vez (ver
 * project_chat_topbar_tabstrip en memoria), nunca queda fijado a un id.
 */
export function ProjectTabStrip({ sessions, projects, activeProjectId, onSelectProject }: ProjectTabStripProps): React.ReactElement | null {
  const projectsWithSessions = useMemo(() => {
    const lastActivityByProject = new Map<string, string>();
    for (const s of sessions) {
      if (!s.project_id) continue;
      const current = lastActivityByProject.get(s.project_id);
      if (!current || new Date(s.updated_at).getTime() > new Date(current).getTime()) {
        lastActivityByProject.set(s.project_id, s.updated_at);
      }
    }
    return projects
      .filter((p) => lastActivityByProject.has(p.id))
      .sort((a, b) => new Date(lastActivityByProject.get(b.id)!).getTime() - new Date(lastActivityByProject.get(a.id)!).getTime());
  }, [sessions, projects]);

  if (projectsWithSessions.length === 0) return null;

  return (
    <div className="flex min-w-0 items-center gap-5 overflow-x-auto">
      {projectsWithSessions.map((project) => (
        <Tab
          key={project.id}
          label={project.name}
          size="sm"
          selected={project.id === activeProjectId}
          onClick={() => onSelectProject(project.id)}
        />
      ))}
    </div>
  );
}
