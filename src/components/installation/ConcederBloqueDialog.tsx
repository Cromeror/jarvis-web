import React, { useEffect, useState } from 'react';
import { Icon } from '../Icon.js';
import type { OrganizationSummary } from '../../lib/organizations-api.js';
import { Button } from '../ui/atoms/Button.js';
import { Dialogo } from '../ui/Dialogo.js';

/**
 * CONCEDER UN BLOQUE DE PUERTOS a una organización.
 *
 * Es el `Dialogo` del sistema: foco atrapado, Escape, y el clic en el fondo
 * que cierra sólo si empieza y termina ahí.
 *
 * Era un formulario permanente arriba de la tabla. Conceder es episódico
 * —pasa cuando entra una organización nueva— y mirar el reparto es lo
 * habitual; un formulario siempre abierto le cobraba un tercio de la vista al
 * caso que ocurre todos los días para servir al que ocurre de vez en cuando.
 *
 * **Se concede a una ORGANIZACIÓN, no a un proyecto.** Es el eje que delimita:
 * la organización contrata y después parte su bloque entre sus proyectos con
 * el módulo de organización `MOD-0005`. Ofrecer acá un selector de proyecto le haría al
 * superadmin el trabajo que el modelo le sacó a propósito.
 */
export function ConcederBloqueDialog({
  organizaciones,
  defaultSize,
  abierto,
  onCerrar,
  onConceder,
}: {
  organizaciones: OrganizationSummary[];
  defaultSize: number;
  abierto: boolean;
  onCerrar: () => void;
  onConceder: (input: { organization_id: string; size: number; note: string | null }) => Promise<void>;
}): React.ReactElement {
  const [orgId, setOrgId] = useState('');
  const [size, setSize] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /* Cada apertura empieza limpia. Sin esto, el error de un intento fallido
     sigue en pantalla la próxima vez que se abre, describiendo algo que ya no
     se está haciendo. */
  useEffect(() => {
    if (abierto) {
      setError(null);
      setSize('');
      setNote('');
    }
  }, [abierto]);

  async function submit(): Promise<void> {
    if (!orgId) return;
    const tamanio = size.trim() === '' ? defaultSize : Number(size);
    setGuardando(true);
    setError(null);
    try {
      await onConceder({ organization_id: orgId, size: tamanio, note: note.trim() || null });
      onCerrar();
    } catch (err) {
      // El error se queda EN el diálogo: es sobre lo que se está escribiendo, y
      // cerrarlo para mostrarlo afuera obligaría a reescribir los tres campos.
      setError(err instanceof Error ? err.message : 'No se pudo conceder el bloque');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      ancho={480}
      onSubmit={() => void submit()}
      titulo="Conceder un bloque"
      descripcion="La organización reparte después su bloque entre sus proyectos."
      pie={
        <>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!orgId || guardando}>
            <Icon name={guardando ? 'cargando' : 'plus'} />
            {guardando ? 'Concediendo…' : 'Conceder'}
          </Button>
        </>
      }
    >
      <div className="sw-puertos__campos">
        <label className="sw-puertos__campo">
          <span className="sw-puertos__lab">Organización</span>
          <select className="select" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">Elegí una…</option>
            {organizaciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <label className="sw-puertos__campo">
          <span className="sw-puertos__lab">Cuántos puertos</span>
          <input
            className="input"
            type="number"
            min={1}
            value={size}
            placeholder={String(defaultSize)}
            onChange={(e) => setSize(e.target.value)}
          />
        </label>

        <label className="sw-puertos__campo">
          <span className="sw-puertos__lab">Para qué (opcional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error ? <p className="sw-puertos__error">{error}</p> : null}

        {/* POR QUÉ NO SE ELIGE EL BLOQUE: es la pregunta que aparece al
            ver que sólo se pide un número. Elegir el `start` a mano
            obligaría a mirar qué está tomado para hacer una cuenta que el
            servidor hace mejor, y además invita a dejar huecos. */}
        <p className="sw-puertos__pista">
          Se elige cuántos puertos, no cuáles: el servidor toma el primer hueco contiguo del pool.
        </p>
      </div>
    </Dialogo>
  );
}
