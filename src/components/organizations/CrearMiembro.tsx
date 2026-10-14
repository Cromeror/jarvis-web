import React, { useState } from 'react';
import { CampoClave } from '../ui/CampoClave.js';
import { crearMiembro } from '../../lib/organizations-api.js';
import { mensajeDeError } from './errores.js';
import { Button } from '../ui/atoms/Button.js';

const PANEL_CLASS = 'rounded-xl border border-border bg-muted p-4';
const INPUT_CLASS = 'input w-full';

/**
 * El administrador de la organización CREA un usuario (`MOD-0006:create`).
 *
 * Nace como miembro de esta organización y SIN ROL: pertenece y no puede nada
 * hasta que se le asigne uno en la tabla de miembros. La pantalla lo dice al
 * crearlo, porque es el paso que falta y no un error.
 *
 * Invitar por correo no está: no se mandan correos todavía.
 */
export function CrearMiembro({
  organizationId,
  onCreado,
}: {
  organizationId: string;
  onCreado?: () => void;
}): React.ReactElement {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);

  async function crear(): Promise<void> {
    setGuardando(true);
    setError(null);
    setCreado(null);
    try {
      const u = await crearMiembro(organizationId, { username: username.trim(), password });
      setCreado(u.username);
      setUsername('');
      setPassword('');
      onCreado?.();
    } catch (err) {
      // El 409 de «no disponible» y el 400 de la política de contraseñas traen
      // un mensaje escrito para mostrarse tal cual.
      setError(mensajeDeError(err, 'No se pudo crear el usuario'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={PANEL_CLASS}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">Crear un usuario en esta organización</h3>
      {error && (
        <div className="mb-3 rounded-lg border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-3 py-2 text-sm text-[var(--sw-on-error)]">{error}</div>
      )}
      {creado && (
        <div className="mb-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-secondary-foreground">
          «{creado}» ya es miembro, sin rol: asignale uno en la tabla de miembros para que pueda hacer algo.
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs text-muted-foreground">Usuario</span>
          <input className={INPUT_CLASS} value={username} autoComplete="off" onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs text-muted-foreground">Contraseña inicial</span>
          <CampoClave value={password} onChange={setPassword} className={INPUT_CLASS} />
        </label>
        <Button
          variant="primary"
          disabled={guardando || !username.trim() || !password}
          onClick={() => void crear()}
        >
          Crear
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Entra a esta organización sin ningún rol. Sólo vas a ver a la gente de tu organización.
      </p>
    </div>
  );
}
