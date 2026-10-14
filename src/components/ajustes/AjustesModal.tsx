import React, { useEffect, useRef } from "react";
import { Icon } from "../Icon.js";
import { AjustesDeOrganizacion } from "./AjustesDeOrganizacion.js";

/**
 * EL MODAL DE AJUSTES. Se abre desde «Ajustes» en el menú del avatar y al pie
 * de la navegación (`useAjustes`), y hoy lleva la configuración de la
 * organización: los módulos de organización que tenga —miembros, puertos, la
 * red de contexto con su auditor—.
 *
 * Es `<dialog class="dialog">` nativo, como `ConcederBloqueDialog`: el browser
 * trae foco atrapado, Escape y backdrop. Se monta sólo abierto: así cada
 * apertura carga lo actual y no queda una configuración vieja en memoria.
 */
export function AjustesModal({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}): React.ReactElement | null {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label="Ajustes"
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {/* 80% del ancho y alto fijo al 90% de la ventana: el modal no salta de tamaño al cambiar de
          módulo o de pestaña, y lo que no entra se desplaza adentro de la sección. */}
      <article
        style={{
          width: "80vw",
          maxWidth: "80vw",
          height: "90vh",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header>
          <h2>Ajustes</h2>
          <p>La configuración de tu organización.</p>
        </header>
        {/* No desplaza: le da el alto al contenido, y cada zona (menú y
            módulo) se desplaza por su cuenta. */}
        <section
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {abierto && <AjustesDeOrganizacion />}
        </section>
        <footer>
          <button
            type="button"
            className="btn"
            data-variant="outline"
            onClick={() => ref.current?.close()}
          >
            <Icon name="x" />
            Cerrar
          </button>
        </footer>
      </article>
    </dialog>
  );
}
