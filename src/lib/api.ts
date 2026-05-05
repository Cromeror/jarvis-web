/**
 * API client — fetch wrappers for all REST endpoints.
 * Design §Frontend structure, Phase 10.
 */

export interface FileEntry {
  path: string;
  type: 'flujo' | 'arquitectura' | 'generico';
  last_modified: string;
  size: number;
}

export interface FileContent {
  path: string;
  type: 'flujo' | 'arquitectura' | 'generico';
  content: string;
}

export interface SaveResult {
  ok: boolean;
  warnings?: string[];
}

export interface CreateResult {
  ok: boolean;
  path: string;
  type: 'flujo' | 'arquitectura' | 'generico';
}

export interface VersionResult {
  ok: boolean;
  version?: string;
  skipped: boolean;
}

export interface VersionEntry {
  version: string;
  size: number;
}

export interface RestoreResult {
  ok: boolean;
  path: string;
  version: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** GET /api/files — list all markdown files, optionally filtered by folder */
export async function listFiles(folder?: string): Promise<FileEntry[]> {
  const params = folder ? `?folder=${encodeURIComponent(folder)}` : '';
  const res = await fetch(`/api/files${params}`);
  return handleResponse<FileEntry[]>(res);
}

/** GET /api/file — read a single file's content */
export async function getFile(path: string): Promise<FileContent> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
  return handleResponse<FileContent>(res);
}

/** PUT /api/file — autosave current content */
export async function saveFile(path: string, content: string): Promise<SaveResult> {
  const res = await fetch('/api/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  return handleResponse<SaveResult>(res);
}

/** POST /api/file — create a new file */
export async function createFile(
  path: string,
  type: 'flujo' | 'arquitectura' | 'generico',
  content?: string,
): Promise<CreateResult> {
  const body: Record<string, string> = { path, type };
  if (content !== undefined) body['content'] = content;
  const res = await fetch('/api/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<CreateResult>(res);
}

/** POST /api/file/version — save a snapshot of the current file */
export async function saveVersion(path: string): Promise<VersionResult> {
  const res = await fetch('/api/file/version', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return handleResponse<VersionResult>(res);
}

/** GET /api/file/versions — list available snapshots */
export async function listVersions(path: string): Promise<VersionEntry[]> {
  const res = await fetch(`/api/file/versions?path=${encodeURIComponent(path)}`);
  return handleResponse<VersionEntry[]>(res);
}

/** POST /api/file/restore — restore a snapshot */
export async function restoreVersion(path: string, version: string): Promise<RestoreResult> {
  const res = await fetch('/api/file/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, version }),
  });
  return handleResponse<RestoreResult>(res);
}
