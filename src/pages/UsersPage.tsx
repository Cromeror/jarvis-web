import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { listProjects } from '../lib/projects-api.js';
import type { ProjectSummary } from '../lib/projects-api.js';
import { listUsers, createUser, updateUser, deleteUser } from '../lib/users-api.js';
import type { UserSummary, UserRole } from '../lib/users-api.js';
import { DataTable, type DataTableColumn } from '../components/ui/organisms/DataTable.js';

function ProjectAccessBadges({ userProjectIds, projects }: { userProjectIds: string[]; projects: ProjectSummary[] }): React.ReactElement {
  if (userProjectIds.length === 0) return <span className="text-xs text-slate-400">Sin proyectos asignados</span>;
  const names = userProjectIds.map((id) => projects.find((p) => p.id === id)?.name ?? id);
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((name) => (
        <span key={name} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {name}
        </span>
      ))}
    </div>
  );
}

interface UserFormState {
  username: string;
  password: string;
  role: UserRole;
  project_ids: string[];
}

const EMPTY_FORM: UserFormState = { username: '', password: '', role: 'user', project_ids: [] };

function UserFormModal({
  projects,
  editing,
  onClose,
  onSaved,
}: {
  projects: ProjectSummary[];
  editing: UserSummary | null;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const [form, setForm] = useState<UserFormState>(
    editing ? { username: editing.username, password: '', role: editing.role, project_ids: editing.project_ids } : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleProject(id: string): void {
    setForm((f) => ({
      ...f,
      project_ids: f.project_ids.includes(id) ? f.project_ids.filter((p) => p !== id) : [...f.project_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, {
          role: form.role,
          password: form.password || undefined,
          project_ids: form.project_ids,
        });
      } else {
        if (!form.username.trim() || !form.password.trim()) {
          throw new Error('Usuario y contraseña son obligatorios');
        }
        await createUser(form);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Usuario</label>
        <input
          type="text"
          value={form.username}
          disabled={!!editing}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 disabled:bg-slate-100"
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
          {editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
        </label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Rol</label>
        <select
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="user">Usuario</option>
          <option value="superadmin">Superadmin</option>
        </select>

        {form.role === 'user' && (
          <>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Proyectos asignados</label>
            <div className="mb-4 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={form.project_ids.includes(p.id)} onChange={() => toggleProject(p.id)} />
                  {p.name}
                </label>
              ))}
              {projects.length === 0 && <p className="px-1 text-xs text-slate-400">No hay proyectos todavía</p>}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}

export function UsersPage(): React.ReactElement {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserSummary | 'new' | null>(null);

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([listUsers(), listProjects()]);
      setUsers(u);
      setProjects(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (currentUser && currentUser.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  async function handleDelete(u: UserSummary): Promise<void> {
    if (!window.confirm(`¿Eliminar el usuario '${u.username}'?`)) return;
    try {
      await deleteUser(u.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const columns: Array<DataTableColumn<UserSummary>> = [
    { key: 'username', header: 'Usuario', render: (u) => <span className="font-medium text-slate-900">{u.username}</span> },
    {
      key: 'role',
      header: 'Rol',
      render: (u) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === 'superadmin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
          {u.role === 'superadmin' ? 'Superadmin' : 'Usuario'}
        </span>
      ),
    },
    {
      key: 'projects',
      header: 'Proyectos',
      render: (u) => (u.role === 'superadmin' ? <span className="text-xs text-slate-400">Todos</span> : <ProjectAccessBadges userProjectIds={u.project_ids} projects={projects} />),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u) => (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(u)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
            Editar
          </button>
          <button type="button" onClick={() => void handleDelete(u)} className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50">
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Usuarios</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Nuevo usuario
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <DataTable columns={columns} rows={users} getRowKey={(u) => u.id} />
      )}

      {editing && (
        <UserFormModal
          projects={projects}
          editing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
