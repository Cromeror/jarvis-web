import React, { useCallback, useEffect, useState } from "react";
import {
  borrarCirculo,
  conectarProyecto,
  crearCirculo,
  desconectarProyecto,
  editarCirculo,
  getAuditoria,
  getRedDeOrganizacion,
  listarInvitaciones,
  sincronizarAhora,
  type Circulo,
  type RedDeOrganizacion,
} from "../../lib/red-de-contexto-api.js";
import { Icon } from "../Icon.js";
import {
  EditarCarpetaDialog,
  NuevoCirculo,
  TablaDeCarpetas,
} from "./carpetas-compartidas.js";
import { mensajeDeError } from "./errores.js";
import { OrganizationAuditorSection } from "./OrganizationAuditorSection.js";
import { OrganizationInvitacionesSection } from "./OrganizationInvitacionesSection.js";

/**
 * LA RED DE CONTEXTO, del lado de la ORGANIZACIÓN (`MOD-0007`,
 * Ajustes → «Organización»): la supervisa.
 *
 * La red la arman los ESPACIOS, desde su propia superficie (Ajustes →
 * «Espacio»): crean sus carpetas compartidas e invitan a otros. Acá la
 * organización aprueba o rechaza cada invitación, ve todas las carpetas —de
 * qué espacio es cada una y con quién se comparte—, decide qué valida el
 * auditor y resuelve la cuarentena. También puede crear carpetas y compartir
 * directamente: lo que ella hace no necesita aprobación, porque es quien aprueba.
 *
 * Lo que cada espacio deja en `contexto-org/<carpeta>/publicado/` les llega a
 * los demás; el sync corre solo cada 30 segundos, y «Sincronizar ahora» no
 * espera. Ver `docs/05-ambito-de-los-modulos.md` del workspace, «Red de contexto».
 */
type Pestana = "carpetas" | "invitaciones" | "auditor" | "cuarentena";

export function OrganizationRedContextoSection({
  organizationId,
}: {
  organizationId: string;
}): React.ReactElement {
  /* TRES PESTAÑAS, por lo que se hace en cada una: armar la red (se toca de vez
     en cuando), decidir qué valida el auditor (una vez), y la cuarentena (el día
     a día: lo que espera a una persona, con su cantidad en la pestaña). */
  const [pestana, setPestana] = useState<Pestana>("carpetas");
  const [enCuarentena, setEnCuarentena] = useState<number | null>(null);
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [datos, setDatos] = useState<RedDeOrganizacion | null>(null);
  /** La carpeta compartida que se está editando en el diálogo. */
  const [editando, setEditando] = useState<Circulo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setDatos(await getRedDeOrganizacion(organizationId));
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo cargar la red de contexto"));
    } finally {
      setCargando(false);
    }
  }, [organizationId]);

  // Montado con `key={organizationId}`: cambiar de organización lo remonta limpio.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Lo que espera a una persona, para el título de las pestañas. Un error deja la pestaña sin número, no la rompe. */
  const contarCuarentena = useCallback(async (): Promise<void> => {
    try {
      setEnCuarentena((await getAuditoria(organizationId)).conteos.cuarentena);
    } catch {
      setEnCuarentena(null);
    }
    try {
      setPendientes((await listarInvitaciones(organizationId)).length);
    } catch {
      setPendientes(null);
    }
  }, [organizationId]);
  useEffect(() => {
    void contarCuarentena();
  }, [contarCuarentena, pestana]);

  const pestanas: Array<{ id: Pestana; etiqueta: string }> = [
    { id: "carpetas", etiqueta: "Carpetas compartidas" },
    {
      id: "invitaciones",
      etiqueta: pendientes ? `Invitaciones (${pendientes})` : "Invitaciones",
    },
    { id: "auditor", etiqueta: "Auditor" },
    {
      id: "cuarentena",
      etiqueta: enCuarentena ? `Cuarentena (${enCuarentena})` : "Cuarentena",
    },
  ];

  /** Corre una acción, muestra su error tal cual y recarga. Todas las de esta sección son así. */
  async function accion(
    fn: () => Promise<unknown>,
    fallback: string,
  ): Promise<boolean> {
    setError(null);
    setAviso(null);
    try {
      await fn();
      await refresh();
      return true;
    } catch (err) {
      setError(mensajeDeError(err, fallback));
      return false;
    }
  }

  async function sincronizar(): Promise<void> {
    setSincronizando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await sincronizarAhora(organizationId);
      setAviso(
        r.errores.length
          ? `Sincronizado con ${r.errores.length} aviso(s): ${r.errores.slice(0, 3).join(" · ")}`
          : `Sincronizado: ${r.escritos} archivo(s) entregados, ${r.borrados} retirados.`,
      );
      await refresh();
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo sincronizar"));
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-white">Red de contexto</h2>
      {/* Pestañas y «Sincronizar ahora» en la MISMA fila: el botón es un enlace
          chico, más bajo que las pestañas, así que aparecer o no en una pestaña
          no cambia el alto de nada y las pestañas no saltan. El tablist es un
          contenedor interno porque sólo puede tener tabs adentro. */}
      <div className="mb-4 flex items-end border-b border-white/10">
        <div className="flex gap-1" role="tablist" aria-label="Red de contexto">
          {pestanas.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={pestana === t.id}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                pestana === t.id
                  ? "border-indigo-400 text-white"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
              onClick={() => setPestana(t.id)}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        {pestana === "carpetas" && datos && datos.circulos.length > 0 && (
          <button
            type="button"
            className="mb-1 ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
            disabled={sincronizando}
            title="Corre la sincronización ya, sin esperar los 30 segundos"
            onClick={() => void sincronizar()}
          >
            <Icon name={sincronizando ? "cargando" : "rehacer"} />
            {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
        )}
      </div>

      {pestana === "carpetas" && (
        <>
          <p className="mb-3 text-xs text-slate-400">
            Una carpeta compartida reúne espacios que comparten documentación.
            Lo que cada uno deja en{" "}
            <code className="text-slate-300">
              contexto-org/&lt;carpeta&gt;/publicado/
            </code>{" "}
            les llega a los demás, y su IA lo encuentra sin que nadie se lo
            pase.
          </p>

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {aviso && (
            <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              {aviso}
            </div>
          )}

          {cargando ? (
            <p className="text-sm text-slate-400">Cargando…</p>
          ) : datos ? (
            <div className="space-y-4">
              <NuevoCirculo
                onCrear={(input) =>
                  accion(
                    () => crearCirculo(organizationId, input),
                    "No se pudo crear la carpeta compartida",
                  )
                }
                vacio={datos.circulos.length === 0}
              />

              <TablaDeCarpetas
                carpetas={datos.circulos}
                proyectos={datos.proyectos}
                mostrarDueno
                onCompartir={(c, p) =>
                  void accion(
                    () => conectarProyecto(organizationId, c.id, p.id),
                    "No se pudo compartir con ese espacio",
                  )
                }
                onDejarDeCompartir={(c, p) => {
                  if (
                    !window.confirm(
                      `¿Dejar de compartir «${c.nombre}» con «${p.name}»? Deja de publicar y de recibir en esta carpeta, y se le retira lo que recibió.`,
                    )
                  )
                    return;
                  void accion(
                    () => desconectarProyecto(organizationId, c.id, p.id),
                    "No se pudo dejar de compartir",
                  );
                }}
                onEditar={(c) => setEditando(c)}
                onBorrar={(c) => {
                  if (
                    !window.confirm(
                      `¿Borrar la carpeta compartida «${c.nombre}»? Lo que recibió cada espacio se le retira en la próxima sincronización. Lo que cada uno publicó se queda en su espacio.`,
                    )
                  )
                    return;
                  void accion(
                    () => borrarCirculo(organizationId, c.id),
                    "No se pudo borrar la carpeta compartida",
                  );
                }}
              />

              <EditarCarpetaDialog
                carpeta={editando}
                onCerrar={() => setEditando(null)}
                onGuardar={(patch) =>
                  editando
                    ? accion(
                        () => editarCirculo(organizationId, editando.id, patch),
                        "No se pudo guardar la carpeta compartida",
                      )
                    : Promise.resolve(false)
                }
              />
            </div>
          ) : null}
        </>
      )}

      {pestana === "invitaciones" && datos && (
        <OrganizationInvitacionesSection
          organizationId={organizationId}
          carpetas={datos.circulos}
          proyectos={datos.proyectos}
          onCambio={() => {
            void refresh();
            void contarCuarentena();
          }}
        />
      )}

      {(pestana === "auditor" || pestana === "cuarentena") && datos && (
        <OrganizationAuditorSection
          key={pestana}
          organizationId={organizationId}
          circulos={datos.circulos}
          proyectos={datos.proyectos}
          vista={pestana === "auditor" ? "reglas" : "bandeja"}
          onCambio={() => void contarCuarentena()}
        />
      )}
    </section>
  );
}
