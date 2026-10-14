import React, { useEffect, useRef, useState } from "react";
import {
  activarEspacioEnLaRed,
  desactivarEspacioEnLaRed,
  type Circulo,
  type MiembroDeCirculo,
  type ProyectoDeRed,
} from "../../lib/red-de-contexto-api.js";
import { timeAgo } from "../../lib/time-ago.js";
import { Icon } from "../Icon.js";
import { Tabla, type ColumnaDeTabla } from "../ui/Tabla.js";
import { INPUT_CLASS } from "./carpetas-compartidas.js";
import { mensajeDeError } from "./errores.js";

type Carpeta = Circulo & { miembros: MiembroDeCirculo[] };

const COLUMNAS: ColumnaDeTabla[] = [
  { id: "espacio", label: "Espacio", dato: "name", w: 260, elastica: true },
  { id: "propias", label: "Carpetas propias", w: 130, al: "der", orden: false },
  { id: "participa", label: "Participa en", w: 120, al: "der", orden: false },
  { id: "estado", label: "En la red", w: 220, orden: false },
];

/**
 * LOS ESPACIOS EN LA RED, del lado de la organización: activarlos o
 * desactivarlos.
 *
 * Desactivar es la CUARENTENA DE UN ESPACIO ENTERO. La cuarentena retiene
 * archivos puntuales; desactivar deja invisible todo lo que el espacio comparte
 * —se retira lo que los demás recibieron de él— y deja de recibir. Su
 * `publicado/` y todo lo que está fuera de la red no se tocan, y reactivarlo
 * vuelve todo como estaba. Como afecta lo que ven OTROS espacios, pide
 * confirmación.
 */
export function OrganizationEspaciosSection({
  organizationId,
  carpetas,
  proyectos,
  onCambio,
}: {
  organizationId: string;
  carpetas: Carpeta[];
  proyectos: ProyectoDeRed[];
  onCambio: () => void;
}): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [aDesactivar, setADesactivar] = useState<ProyectoDeRed | null>(null);

  const propias = (p: ProyectoDeRed) =>
    carpetas.filter((c) => c.owner_project_id === p.id).length;
  const participa = (p: ProyectoDeRed) =>
    carpetas.filter(
      (c) =>
        c.owner_project_id !== p.id &&
        c.miembros.some(
          (m) => m.project_id === p.id && m.estado === "aprobada",
        ),
    ).length;

  async function accion(
    fn: () => Promise<unknown>,
    fallback: string,
  ): Promise<boolean> {
    setError(null);
    try {
      await fn();
      onCambio();
      return true;
    } catch (err) {
      setError(mensajeDeError(err, fallback));
      return false;
    }
  }

  function celda(p: ProyectoDeRed, col: ColumnaDeTabla): React.ReactNode {
    switch (col.id) {
      case "espacio":
        return (
          <div className="py-2 leading-tight">
            <div className="truncate font-medium text-white">{p.name}</div>
            <code className="text-[11px] text-slate-500">{p.id}</code>
          </div>
        );
      case "propias":
        return propias(p);
      case "participa":
        return participa(p);
      case "estado":
        if (p.desactivado) {
          return (
            <span
              className="inline-flex items-center gap-1 text-amber-300"
              title={`Desactivado ${timeAgo(p.desactivado.desde)}${p.desactivado.nota ? ` — ${p.desactivado.nota}` : ""}`}
            >
              <Icon name="eyeOff" />
              Desactivado
            </span>
          );
        }
        if (!p.tiene_root) {
          return (
            <span
              className="inline-flex items-center gap-1 text-slate-400"
              title="No tiene carpeta en el servidor: no tiene dónde publicar ni recibir."
            >
              <Icon name="info" />
              Sin carpeta
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <Icon name="check" />
            Activo
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <section>
      <p className="mb-3 text-xs text-slate-400">
        Desactivar un espacio deja invisible todo lo que comparte en la red —lo
        que los demás recibieron de él se retira— y deja de recibir. Es la
        cuarentena de un espacio entero; reactivarlo vuelve todo como estaba.
      </p>
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <Tabla<ProyectoDeRed>
        titulo="Espacios en la red"
        columnas={COLUMNAS}
        filas={proyectos}
        clave={(p) => p.id}
        nombreFila={(p) => p.name}
        seleccion={false}
        celda={celda}
        menuFila={(p) => ({
          groups: [
            {
              items: p.desactivado
                ? [{ id: "activar", label: "Activar en la red", icon: "eye" }]
                : [
                    {
                      id: "desactivar",
                      label: "Desactivar en la red…",
                      icon: "eyeOff",
                      danger: true,
                    },
                  ],
            },
          ],
          onSelect: (id, fila) => {
            if (id === "desactivar") setADesactivar(fila);
            if (id === "activar") {
              if (
                !window.confirm(
                  `¿Activar «${fila.name}» en la red? Vuelve a compartir y a recibir en la próxima sincronización, que corre ya.`,
                )
              )
                return;
              void accion(
                () => activarEspacioEnLaRed(organizationId, fila.id),
                "No se pudo activar el espacio",
              );
            }
          },
        })}
        textos={{ vacio: "La organización no tiene espacios" }}
      />

      <ConfirmarDesactivar
        espacio={aDesactivar}
        onCerrar={() => setADesactivar(null)}
        onConfirmar={(nota) =>
          aDesactivar
            ? accion(
                () =>
                  desactivarEspacioEnLaRed(
                    organizationId,
                    aDesactivar.id,
                    nota || undefined,
                  ),
                "No se pudo desactivar el espacio",
              )
            : Promise.resolve(false)
        }
      />
    </section>
  );
}

/**
 * Confirmar que se desactiva un espacio en la red. Es un diálogo con su propio
 * botón —y no un `confirm()`— porque afecta lo que ven OTROS espacios, y quien
 * confirma tiene que leer qué pasa antes de hacerlo. La nota la lee el equipo
 * del espacio en su pantalla.
 */
function ConfirmarDesactivar({
  espacio,
  onCerrar,
  onConfirmar,
}: {
  espacio: ProyectoDeRed | null;
  onCerrar: () => void;
  onConfirmar: (nota: string) => Promise<boolean>;
}): React.ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (espacio) {
      setNota("");
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [espacio]);

  async function confirmar(): Promise<void> {
    setEnviando(true);
    const ok = await onConfirmar(nota.trim());
    setEnviando(false);
    if (ok) ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <article
        style={{ width: "100%", maxWidth: "min(560px, calc(100vw - 2rem))" }}
      >
        <header>
          <h2>Desactivar «{espacio?.name}» en la red</h2>
          <p>Afecta lo que ven los demás espacios.</p>
        </header>
        <section className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-slate-300">
            <li>Lo que los demás espacios recibieron de él se les retira.</li>
            <li>Deja de recibir lo que comparten los demás.</li>
            <li>
              Su carpeta publicado/ y todo lo que está fuera de la red no se
              tocan.
            </li>
            <li>Se puede volver a activar, y todo vuelve como estaba.</li>
          </ul>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">
              Por qué (opcional) — lo lee el equipo del espacio
            </span>
            <textarea
              className={`${INPUT_CLASS} min-h-20 text-xs`}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </label>
        </section>
        <footer>
          <button
            type="button"
            className="btn"
            data-variant="outline"
            onClick={() => ref.current?.close()}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            data-variant="destructive"
            disabled={enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? "Desactivando…" : "Desactivar"}
          </button>
        </footer>
      </article>
    </dialog>
  );
}
