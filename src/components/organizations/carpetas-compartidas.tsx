import React, { useEffect, useRef, useState } from "react";
import type {
  Circulo,
  MiembroDeCirculo,
  ProyectoDeRed,
} from "../../lib/red-de-contexto-api.js";
import {
  estadoEnLaCarpeta,
  slugDeNombre,
  slugValido,
} from "../../modules/red-de-contexto/estado.js";
import type { StatusBadgeTone } from "../ui/atoms/StatusBadge.js";
import { Tabla, type ColumnaDeTabla } from "../ui/Tabla.js";
import { ChipsDeEspacios } from "./ChipsDeEspacios.js";

/**
 * LAS PIEZAS DE LAS CARPETAS COMPARTIDAS que comparten las dos superficies de
 * la red de contexto: la tabla, el formulario para crear y el diálogo para
 * editar. La del espacio arma la red; la de la organización la supervisa
 * (`docs/05-ambito-de-los-modulos.md` del workspace, «Red de contexto»).
 */

/** Mismas superficies que `OrganizationPortsSection`: viven en el mismo panel y tienen que leerse igual. */
export const PANEL_CLASS =
  "rounded-xl border border-white/10 bg-white/[0.03] p-4";
export const INPUT_CLASS =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400 [&>option]:bg-[#221f1d] [&>option]:text-white";
export const BOTON_PRIMARIO =
  "rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";

export type CarpetaDeTabla = Circulo & { miembros: MiembroDeCirculo[] };

/* La tabla reparte el ancho que sobra en proporción al ideal de cada columna:
   con 200 · 200 · 600, «Se comparte con» se queda con el 60%. */
const COLUMNAS_CARPETAS: ColumnaDeTabla[] = [
  { id: "nombre", label: "Nombre", dato: "nombre", w: 200 },
  { id: "descripcion", label: "Descripción", w: 200, orden: false },
  {
    id: "espacios",
    label: "Se comparte con",
    w: 600,
    elastica: true,
    orden: false,
  },
];

/** La descripción es un resumen: más de esto ya no es para leer en una fila. Completa, en el globo. */
const DESCRIPCION_MAX = 200;

/**
 * EL ESTADO ES DE CADA ESPACIO, no de la carpeta: cada uno recibe por su cuenta
 * y uno puede fallar mientras los demás andan. Por eso va en el chip de cada
 * espacio, como un ícono —se ve de un vistazo cuál anda mal— con su detalle en
 * el globo.
 */
const ICONO_DE_ESTADO: Record<
  StatusBadgeTone,
  { icono: string; clase: string }
> = {
  success: { icono: "check", clase: "text-emerald-400" },
  warning: { icono: "alerta", clase: "text-amber-400" },
  danger: { icono: "alerta", clase: "text-red-400" },
  neutral: { icono: "reloj", clase: "text-slate-400" },
  // Pendiente de aprobación: espera a una persona, no al sync.
  info: { icono: "reloj", clase: "text-sky-400" },
};

/**
 * LAS CARPETAS COMPARTIDAS, en la tabla de siempre (`ui/Tabla`, la misma de
 * Puertos y Usuarios).
 *
 * La usan las dos superficies de la red: la del ESPACIO (Ajustes → «Espacio»),
 * donde se arman las carpetas propias y se invita, y la de la ORGANIZACIÓN
 * (Ajustes → «Organización»), que las supervisa.
 *
 * Compartir es una opción del MENÚ DE CADA FILA, y hay una por cada espacio de
 * la organización —menos el propio, en la del espacio—: marcada si ya se
 * comparte con él o está invitado. Tocarla invita (o comparte, si lo hace la
 * organización) o deja de compartir, con confirmación. Lo que el menú y los
 * chips dicen de cada espacio es su estado EN ESTA carpeta
 * (`estadoEnLaCarpeta`): pendiente de aprobación, rechazada, o cómo le va al
 * sync.
 */
export function TablaDeCarpetas({
  carpetas,
  proyectos,
  excluir,
  mostrarDueno = false,
  onCompartir,
  onDejarDeCompartir,
  onEditar,
  onBorrar,
}: {
  carpetas: CarpetaDeTabla[];
  proyectos: ProyectoDeRed[];
  /** Un espacio que no va en el menú de compartir: el propio, en la superficie del espacio. */
  excluir?: string;
  /** Decir de qué espacio es cada carpeta (en la superficie de la organización). */
  mostrarDueno?: boolean;
  onCompartir: (c: CarpetaDeTabla, p: ProyectoDeRed) => void;
  onDejarDeCompartir: (c: CarpetaDeTabla, p: ProyectoDeRed) => void;
  onEditar: (c: CarpetaDeTabla) => void;
  onBorrar: (c: CarpetaDeTabla) => void;
}): React.ReactElement {
  const porId = new Map(proyectos.map((p) => [p.id, p]));
  const proyectoDe = (m: MiembroDeCirculo): ProyectoDeRed =>
    porId.get(m.project_id) ?? {
      id: m.project_id,
      name: m.project_id,
      con_modulo: true,
      tiene_root: true,
    };
  /* CON QUIÉN SE COMPARTE: los miembros menos el dueño. El dueño figura como
     miembro de su propia carpeta porque el sync necesita leer lo que publica,
     pero no "se comparte" consigo mismo: nombrarlo acá, o dejar tildarlo en el
     menú, era decir que se compartía con él. */
  const conQuien = (c: CarpetaDeTabla) =>
    c.miembros.filter((m) => m.project_id !== c.owner_project_id);
  const estados = (c: CarpetaDeTabla) =>
    conQuien(c).map((m) => ({
      nombre: proyectoDe(m).name,
      e: estadoEnLaCarpeta(m, proyectoDe(m)),
    }));

  function celda(c: CarpetaDeTabla, col: ColumnaDeTabla): React.ReactNode {
    switch (col.id) {
      case "nombre":
        /* El nombre y, abajo, dónde vive en cada espacio. */
        return (
          <div className="py-2 leading-tight">
            <div className="truncate font-medium text-white">{c.nombre}</div>
            <code className="text-[11px] text-slate-400">
              contexto-org/{c.slug}/
            </code>
            {mostrarDueno && (
              <div className="text-[11px] text-slate-500">
                {c.owner_project_id
                  ? `de ${porId.get(c.owner_project_id)?.name ?? c.owner_project_id}`
                  : "de la organización"}
              </div>
            )}
          </div>
        );
      case "descripcion": {
        /* Hasta dos líneas y DESCRIPCION_MAX caracteres; completa en el globo.
           La tabla deja una sola línea por celda (su CSS es del template y no se
           toca), así que el salto se habilita acá adentro. */
        const texto = c.contexto.trim();
        if (!texto)
          return <span className="text-slate-500">Sin descripción</span>;
        const corto =
          texto.length > DESCRIPCION_MAX
            ? `${texto.slice(0, DESCRIPCION_MAX).trimEnd()}…`
            : texto;
        return (
          <div
            className="line-clamp-2 whitespace-normal py-2 text-xs leading-snug text-slate-300"
            title={texto}
          >
            {corto}
          </div>
        );
      }
      case "espacios":
        if (conQuien(c).length === 0)
          return (
            <span className="text-slate-500">Todavía con ningún espacio</span>
          );
        return (
          <ChipsDeEspacios
            chips={estados(c).map((x) => {
              const i = ICONO_DE_ESTADO[x.e.tono];
              return {
                nombre: x.nombre,
                icono: x.e.icono ?? i.icono,
                claseIcono: i.clase,
                etiqueta: x.e.etiqueta,
                detalle: `${x.e.etiqueta}${x.e.detalle ? ` — ${x.e.detalle}` : ""}`,
              };
            })}
          />
        );
      default:
        return null;
    }
  }

  return (
    <Tabla<CarpetaDeTabla>
      titulo="Carpetas compartidas"
      columnas={COLUMNAS_CARPETAS}
      filas={carpetas}
      clave={(c) => c.id}
      nombreFila={(c) => c.nombre}
      seleccion={false}
      celda={celda}
      menuFila={(c) => {
        const miembroDe = (id: string) =>
          c.miembros.find((m) => m.project_id === id);
        const candidatos = proyectos.filter(
          (p) => p.id !== excluir && p.id !== c.owner_project_id,
        );
        return {
          groups: [
            {
              items: candidatos.length
                ? candidatos.map((p) => {
                    const m = miembroDe(p.id);
                    const sufijo =
                      m?.estado === "pendiente"
                        ? " — pendiente de aprobación"
                        : m?.estado === "rechazada"
                          ? " — rechazada"
                          : !p.con_modulo
                            ? " — sin la red"
                            : !p.tiene_root
                              ? " — sin carpeta"
                              : "";
                    /* Sin carpeta en el servidor no hay dónde recibir: no se
                       ofrece invitarlo. Sí se puede sacar si ya estaba. */
                    const sinDondeRecibir = !p.tiene_root && !m;
                    return {
                      id: `espacio:${p.id}`,
                      label: sinDondeRecibir
                        ? `${p.name} — sin carpeta, no puede recibir`
                        : `${p.name}${sufijo}`,
                      // Rechazada no cuenta como compartida: tocarla la vuelve a pedir.
                      checked: Boolean(m) && m?.estado !== "rechazada",
                      disabled: sinDondeRecibir,
                    };
                  })
                : [
                    {
                      id: "sin-espacios",
                      label: "La organización no tiene espacios",
                      disabled: true,
                    },
                  ],
            },
            {
              items: [
                {
                  id: "editar",
                  label: "Editar nombre y contexto…",
                  icon: "sliders",
                },
              ],
            },
            {
              items: [{ id: "borrar", label: "Borrar carpeta", danger: true }],
            },
          ],
          onSelect: (id, fila) => {
            if (id === "editar") return onEditar(fila);
            if (id === "borrar") return onBorrar(fila);
            if (id.startsWith("espacio:")) {
              const p = porId.get(id.slice("espacio:".length));
              if (!p) return;
              const m = fila.miembros.find((x) => x.project_id === p.id);
              if (m && m.estado !== "rechazada") onDejarDeCompartir(fila, p);
              else onCompartir(fila, p);
            }
          },
        };
      }}
      textos={{
        vacio: "Todavía no hay carpetas compartidas",
        vacioPaso: "Creá la primera con el formulario de arriba.",
      }}
    />
  );
}

/**
 * Editar el nombre y el contexto general de una carpeta compartida. La carpeta
 * en disco (el slug) no se cambia: es la ruta en cada espacio.
 *
 * `<dialog>` nativo, como `ConcederBloqueDialog`: foco atrapado, Escape y
 * backdrop sin escribirlos.
 */
export function EditarCarpetaDialog({
  carpeta,
  onCerrar,
  onGuardar,
}: {
  carpeta: Circulo | null;
  onCerrar: () => void;
  onGuardar: (patch: {
    nombre?: string;
    contexto?: string;
  }) => Promise<boolean>;
}): React.ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const [nombre, setNombre] = useState("");
  const [contexto, setContexto] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (carpeta) {
      setNombre(carpeta.nombre);
      setContexto(carpeta.contexto);
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [carpeta]);

  const cambio =
    carpeta !== null &&
    (nombre.trim() !== carpeta.nombre || contexto !== carpeta.contexto);

  async function guardar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!carpeta || !cambio || !nombre.trim()) return;
    setGuardando(true);
    const ok = await onGuardar({
      ...(nombre.trim() !== carpeta.nombre ? { nombre: nombre.trim() } : {}),
      ...(contexto !== carpeta.contexto ? { contexto } : {}),
    });
    setGuardando(false);
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
        style={{ width: "100%", maxWidth: "min(640px, calc(100vw - 2rem))" }}
      >
        <form onSubmit={(e) => void guardar(e)}>
          <header>
            <h2>Editar carpeta compartida</h2>
            {carpeta && (
              <p>
                En cada espacio: <code>contexto-org/{carpeta.slug}/</code> — no
                se cambia.
              </p>
            )}
          </header>
          <section className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Nombre</span>
              <input
                className={INPUT_CLASS}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">
                Contexto general — lo leen todos los espacios con los que se
                comparte, y su IA, en el LEEME.md
              </span>
              <textarea
                className={`${INPUT_CLASS} min-h-40 font-mono text-xs`}
                value={contexto}
                placeholder="Para qué existe esta carpeta y qué tiene que saber cada equipo del otro."
                onChange={(e) => setContexto(e.target.value)}
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
              type="submit"
              className="btn"
              disabled={!cambio || !nombre.trim() || guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </footer>
        </form>
      </article>
    </dialog>
  );
}

export function NuevoCirculo({
  onCrear,
  vacio,
}: {
  onCrear: (input: {
    slug: string;
    nombre: string;
    contexto?: string;
  }) => Promise<boolean>;
  vacio: boolean;
}): React.ReactElement {
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  /** Mientras nadie toque el slug, sigue al nombre. Una vez editado a mano, es de quien lo editó. */
  const [slugTocado, setSlugTocado] = useState(false);
  const [contexto, setContexto] = useState("");
  const [creando, setCreando] = useState(false);

  const slugFinal = slugTocado ? slug : slugDeNombre(nombre);
  const valido = nombre.trim().length > 0 && slugValido(slugFinal);

  async function crear(): Promise<void> {
    setCreando(true);
    const ok = await onCrear({
      nombre: nombre.trim(),
      slug: slugFinal,
      ...(contexto.trim() ? { contexto } : {}),
    });
    setCreando(false);
    if (ok) {
      setNombre("");
      setSlug("");
      setSlugTocado(false);
      setContexto("");
    }
  }

  return (
    <div className={PANEL_CLASS}>
      <h3 className="mb-1 text-sm font-semibold text-white">
        {vacio
          ? "Crear la primera carpeta compartida"
          : "Nueva carpeta compartida"}
      </h3>
      {vacio && (
        <p className="mb-3 text-xs text-slate-400">
          Por ejemplo «Producto», con diseño y desarrollo adentro: lo que diseño
          publica le llega a desarrollo, y al revés.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs text-slate-400">Nombre</span>
          <input
            className={INPUT_CLASS}
            value={nombre}
            placeholder="Producto"
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="w-56">
          <span className="mb-1 block text-xs text-slate-400">
            Carpeta (no se cambia después)
          </span>
          <input
            className={`${INPUT_CLASS} font-mono`}
            value={slugFinal}
            placeholder="producto"
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value);
            }}
          />
        </label>
      </div>
      {slugFinal && !slugValido(slugFinal) && (
        <p className="mt-1 text-xs text-amber-300">
          La carpeta va en minúsculas, números y guiones, y empieza con letra o
          número.
        </p>
      )}
      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-slate-400">
          Contexto general (opcional, se puede escribir después)
        </span>
        <textarea
          className={`${INPUT_CLASS} min-h-20 font-mono text-xs`}
          value={contexto}
          placeholder="Para qué existe esta carpeta y qué tiene que saber cada equipo del otro."
          onChange={(e) => setContexto(e.target.value)}
        />
      </label>
      <div className="mt-3">
        <button
          type="button"
          className={BOTON_PRIMARIO}
          disabled={!valido || creando}
          onClick={() => void crear()}
        >
          Crear carpeta compartida
        </button>
      </div>
    </div>
  );
}
