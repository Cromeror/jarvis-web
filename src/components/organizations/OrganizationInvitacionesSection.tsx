import React, { useCallback, useEffect, useState } from "react";
import {
  decidirInvitacion,
  listarInvitaciones,
  type Circulo,
  type MiembroDeCirculo,
  type ProyectoDeRed,
} from "../../lib/red-de-contexto-api.js";
import { timeAgo } from "../../lib/time-ago.js";
import { INPUT_CLASS, PANEL_CLASS } from "./carpetas-compartidas.js";
import { mensajeDeError } from "./errores.js";

const BOTON_APROBAR =
  "rounded-lg px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40";
const BOTON_RECHAZAR =
  "rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40";

/**
 * LAS INVITACIONES ENTRE ESPACIOS que esperan a la organización.
 *
 * La red la arman los espacios: uno crea una carpeta compartida e invita a
 * otro. La invitación queda pendiente —no se le entrega nada— hasta que la
 * organización la aprueba acá. Rechazarla lleva una nota, que es lo que lee
 * quien invitó para saber por qué.
 */
export function OrganizationInvitacionesSection({
  organizationId,
  carpetas,
  proyectos,
  onCambio,
}: {
  organizationId: string;
  carpetas: Circulo[];
  proyectos: ProyectoDeRed[];
  /** Una decisión cambia la red: quien tiene la tabla y los contadores los recarga. */
  onCambio: () => void;
}): React.ReactElement {
  const [invitaciones, setInvitaciones] = useState<MiembroDeCirculo[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setInvitaciones(await listarInvitaciones(organizationId));
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, "No se pudieron cargar las invitaciones"));
    }
  }, [organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const carpetaPorId = new Map(carpetas.map((c) => [c.id, c]));
  const nombre = (id: string | null): string =>
    id ? (proyectos.find((p) => p.id === id)?.name ?? id) : "la organización";

  async function decidir(
    inv: MiembroDeCirculo,
    estado: "aprobada" | "rechazada",
    nota: string,
  ): Promise<boolean> {
    setError(null);
    try {
      await decidirInvitacion(organizationId, inv.circulo_id, inv.project_id, {
        estado,
        ...(nota ? { nota } : {}),
      });
      await refresh();
      onCambio();
      return true;
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo guardar la decisión"));
      return false;
    }
  }

  return (
    <section>
      <p className="mb-3 text-xs text-slate-400">
        Un espacio invitó a otro a una carpeta compartida suya. No le llega nada
        hasta que lo apruebes; si lo rechazás, la nota la lee quien invitó.
      </p>
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {invitaciones === null ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : invitaciones.length === 0 ? (
        <div className={PANEL_CLASS}>
          <p className="text-xs text-slate-400">
            Ninguna invitación esperando una decisión.
          </p>
        </div>
      ) : (
        <ul className={`${PANEL_CLASS} divide-y divide-white/5`}>
          {invitaciones.map((inv) => {
            const c = carpetaPorId.get(inv.circulo_id);
            return (
              <FilaDeInvitacion
                key={`${inv.circulo_id}/${inv.project_id}`}
                carpeta={c?.nombre ?? inv.circulo_id}
                slug={c?.slug ?? ""}
                de={nombre(c?.owner_project_id ?? null)}
                a={nombre(inv.project_id)}
                cuando={timeAgo(inv.created_at)}
                onDecidir={(estado, nota) => decidir(inv, estado, nota)}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FilaDeInvitacion({
  carpeta,
  slug,
  de,
  a,
  cuando,
  onDecidir,
}: {
  carpeta: string;
  slug: string;
  de: string;
  a: string;
  cuando: string;
  onDecidir: (
    estado: "aprobada" | "rechazada",
    nota: string,
  ) => Promise<boolean>;
}): React.ReactElement {
  const [nota, setNota] = useState("");
  const [decidiendo, setDecidiendo] = useState(false);

  async function decidir(estado: "aprobada" | "rechazada"): Promise<void> {
    setDecidiendo(true);
    const ok = await onDecidir(estado, nota.trim());
    setDecidiendo(false);
    if (ok) setNota("");
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium text-white">{de}</span>
        <span className="text-slate-400">comparte</span>
        <span className="font-medium text-white">«{carpeta}»</span>
        <span className="text-slate-400">con</span>
        <span className="font-medium text-white">{a}</span>
        <span className="text-xs text-slate-500">· {cuando}</span>
      </div>
      {slug && (
        <code className="text-[11px] text-slate-500">contexto-org/{slug}/</code>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className={`${INPUT_CLASS} max-w-md text-xs`}
          value={nota}
          placeholder="Nota para quien invitó (opcional; al rechazar, decí por qué)"
          onChange={(e) => setNota(e.target.value)}
        />
        <button
          type="button"
          className={BOTON_APROBAR}
          disabled={decidiendo}
          onClick={() => void decidir("aprobada")}
        >
          Aprobar
        </button>
        <button
          type="button"
          className={BOTON_RECHAZAR}
          disabled={decidiendo}
          onClick={() => void decidir("rechazada")}
        >
          Rechazar
        </button>
      </div>
    </li>
  );
}
