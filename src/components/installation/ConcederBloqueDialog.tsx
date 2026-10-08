import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon.js';
import type { OrganizationSummary } from '../../lib/organizations-api.js';

/**
 * CONCEDER UN BLOQUE DE PUERTOS a una organización.
 *
 * Es `<dialog class="dialog">` de Basecoat con la anatomía del template
 * (`<article>` > `<header>` + `<section>` + `<footer>`), la misma que usa el
 * visor de causación — y **nativo a propósito**: el `<dialog>` del browser
 * trae foco atrapado, Escape y backdrop sin que haya que escribirlos.
 *
 * Era un formulario permanente arriba de la tabla. Conceder es episódico
 * —pasa cuando entra una organización nueva— y mirar el reparto es lo
 * habitual; un formulario siempre abierto le cobraba un tercio de la vista al
 * caso que ocurre todos los días para servir al que ocurre de vez en cuando.
 *
 * **Se concede a una ORGANIZACIÓN, no a un proyecto.** Es el eje que delimita:
 * la organización contrata y después parte su bloque entre sus proyectos con
 * `environments-002:ports`. Ofrecer acá un selector de proyecto le haría al
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
  const ref = useRef<HTMLDialogElement>(null);
  const [orgId, setOrgId] = useState('');
  const [size, setSize] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /* `showModal()` y no el atributo `open`: sólo el método pone el backdrop y
     atrapa el foco. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

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

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
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
    /* `onClose` cubre las salidas que no pasan por nuestro botón —Escape y el
       backdrop—: sin esto el diálogo se cierra y el estado de arriba sigue
       creyendo que está abierto, así que no vuelve a abrirse. */
    <dialog
      ref={ref}
      className="dialog sw-puertos__dlg"
      onClose={onCerrar}
      /* CLIC AFUERA CIERRA. El `<dialog>` nativo no lo trae —sólo Escape— y el
         backdrop es parte del PROPIO dialog, no un nodo aparte: por eso el clic
         se escucha acá y se compara el target contra el elemento. */
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <article>
        <form onSubmit={(e) => void submit(e)}>
          <header>
            <h2>Conceder un bloque</h2>
            <p>La organización reparte después su bloque entre sus proyectos.</p>
          </header>

          <section>
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
          </section>

          <footer>
            <button type="button" className="btn" data-variant="outline" onClick={() => ref.current?.close()}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={!orgId || guardando}>
              <Icon name={guardando ? 'cargando' : 'plus'} />
              {guardando ? 'Concediendo…' : 'Conceder'}
            </button>
          </footer>
        </form>
      </article>
    </dialog>
  );
}
