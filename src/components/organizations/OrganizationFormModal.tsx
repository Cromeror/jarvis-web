import React, { useMemo, useState } from 'react';
import { createOrganization } from '../../lib/organizations-api.js';
import type { UserSummary } from '../../lib/users-api.js';
import { mensajeDeError } from './errores.js';
import { Dialogo } from '../ui/Dialogo.js';
import { Button } from '../ui/atoms/Button.js';

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

  async function handleSubmit(): Promise<void> {
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
    <Dialogo
      abierto
      onCerrar={onClose}
      titulo="Nueva organización"
      onSubmit={() => void handleSubmit()}
      ancho={480}
      pie={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creando…' : 'Crear'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error && (
          <div className="rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-xs text-[var(--sw-on-error)]">
            {error}
          </div>
        )}

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Nombre</span>
          <input
            type="text"
            className="input w-full"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Slug (opcional)</span>
          <input
            type="text"
            className="input w-full"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="se deriva del nombre"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Administrador (opcional)</span>
          <select
            className="select w-full"
            value={form.owner_user_id}
            onChange={(e) => setForm((f) => ({ ...f, owner_user_id: e.target.value }))}
          >
            <option value="">Sin administrador — se agrega después</option>
            {candidatos.map(({ user, elegible, motivo }) => (
              <option key={user.id} value={user.id} disabled={!elegible}>
                {user.username}
                {motivo ? ` — ${motivo}` : ''}
              </option>
            ))}
          </select>
        </label>

        {!hayElegibles && (
          <p className="rounded-lg border border-[var(--sw-warning)] bg-[var(--sw-warning-bg)] px-3 py-2 text-[11px] text-[var(--sw-on-warning)]">
            Ninguna persona está disponible como administrador: todas pertenecen ya a una organización, y cada una
            pertenece a una sola. Creala vacía y después dá de alta usuarios adentro.
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">
          {form.owner_user_id
            ? 'Nace con un rol «Administrador» con todos los permisos de organización, y esta persona adentro.'
            : 'Nace con su rol «Administrador» pero sin miembros. Para poblarla, dá de alta un usuario eligiéndola como su organización, o sumá a alguien con «Agregar usuario».'}
        </p>
      </div>
    </Dialogo>
  );
}
