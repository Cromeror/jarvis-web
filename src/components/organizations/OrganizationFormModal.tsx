import React, { useMemo, useState } from 'react';
import { createOrganization } from '../../lib/organizations-api.js';
import type { UserSummary } from '../../lib/users-api.js';
import { mensajeDeError } from './errores.js';

/** Controles DENTRO del modal, que es una tarjeta clara sobre el overlay. */
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 [&>option]:bg-white [&>option]:text-slate-700';

/**
 * Alta de una organización, con su administrador fundador o vacía.
 *
 * Vive en su propio archivo porque lo abre la PÁGINA (el botón está en la
 * cabecera, junto al de nuevo usuario) y lo consumen dos lugares: quedarse
 * adentro del panel de roles obligaba a que el panel fuera el dueño del botón,
 * que es justamente la separación en dos pestañas que se quitó.
 *
 * El administrador es OPCIONAL: sin él la organización nace vacía. Es lo que
 * destraba el caso normal — como cada usuario recibe su propia organización al
 * darse de alta, en general no queda nadie libre para fundar otra.
 */
export function OrganizationFormModal({
  users,
  onClose,
  onCreated,
}: {
  users: UserSummary[];
  onClose: () => void;
  onCreated: (id: string) => void;
}): React.ReactElement {
  const [form, setForm] = useState({ name: '', slug: '', owner_user_id: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Quién PUEDE fundar: sólo alguien que todavía no pertenece a ninguna
   * organización.
   *
   * El backend ya lo rechaza (`UserAlreadyInOrganizationError`), así que sin
   * este filtro el select ofrece opciones que siempre fallan al guardar — y el
   * error llega después de escribir el nombre y elegir, cuando ya no se puede
   * hacer nada con él.
   *
   * Los no elegibles se muestran DESHABILITADOS y con su organización, en vez
   * de esconderse: quien busca a una persona en la lista tiene que poder ver
   * por qué no está disponible, que es el dato con el que se resuelve (sacarla
   * de la otra organización primero).
   */
  const candidatos = useMemo(
    () =>
      users.map((u) => ({
        user: u,
        elegible: !u.organization,
        motivo: u.organization ? `ya está en ${u.organization.organization_name}` : null,
      })),
    [users],
  );
  const hayElegibles = candidatos.some((c) => c.elegible);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!form.name.trim()) throw new Error('La organización necesita un nombre');
      const org = await createOrganization({
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        // Vacío = nadie, y así viaja: sin la clave el backend entiende lo mismo.
        owner_user_id: form.owner_user_id || undefined,
      });
      onCreated(org.id);
    } catch (err) {
      setError(mensajeDeError(err, 'Error al crear la organización'));
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
          <h2 className="text-base font-semibold text-slate-900">Nueva organización</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            Cerrar
          </button>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Nombre</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={`mb-3 ${INPUT_CLASS}`}
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Slug (opcional)</label>
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          placeholder="se deriva del nombre"
          className={`mb-3 ${INPUT_CLASS}`}
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Administrador (opcional)
        </label>
        <select
          value={form.owner_user_id}
          onChange={(e) => setForm((f) => ({ ...f, owner_user_id: e.target.value }))}
          className={`mb-1 ${INPUT_CLASS}`}
        >
          <option value="">Sin administrador — se agrega después</option>
          {candidatos.map(({ user, elegible, motivo }) => (
            <option key={user.id} value={user.id} disabled={!elegible}>
              {user.username}
              {motivo ? ` — ${motivo}` : ''}
            </option>
          ))}
        </select>

        {!hayElegibles && (
          <p className="mb-3 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Ninguna persona está disponible como administrador: todas pertenecen ya a una organización, y cada una
            pertenece a una sola. Creala vacía y después dá de alta usuarios adentro.
          </p>
        )}

        <p className="mb-4 text-[11px] text-slate-400">
          {form.owner_user_id
            ? 'Nace con un rol «Administrador» con todos los permisos de organización, y esta persona adentro.'
            : 'Nace con su rol «Administrador» pero sin miembros. Para poblarla, dá de alta un usuario eligiéndola como su organización, o sumá a alguien desde «Miembros».'}
        </p>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Creando…' : 'Crear'}
        </button>
      </form>
    </div>
  );
}
