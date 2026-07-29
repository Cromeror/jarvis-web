/**
 * API client for projects endpoints.
 * Spec §3.1/3.2, T8.
 */

export interface ProjectRecentChat {
  id: string;
  title: string | null;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  sector: string | null;
  status: string;
  sdd_enabled: boolean | null;
  integrations_count: number;
  skills_count: number;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  chats_count: number;
  recent_chats: ProjectRecentChat[];
}

export type ContextFormat = 'yaml' | 'toon';

export interface ContextResponse {
  format: ContextFormat;
  content: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/projects — list all projects */
export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch('/api/projects');
  return handleResponse<ProjectSummary[]>(res);
}

/** GET /api/context/:project_id — fetch project context in yaml or toon format */
export async function getProjectContext(
  projectId: string,
  format: ContextFormat = 'yaml',
): Promise<ContextResponse> {
  const res = await fetch(`/api/context/${encodeURIComponent(projectId)}?format=${format}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  const content = await res.text();
  return { format, content };
}
