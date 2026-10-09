import React from 'react';

/**
 * LA TOOLBAR — una pieza OPCIONAL de la superficie, no del chasis.
 *
 * En el vocabulario de `SpaceMyWork-nombres.md` (propuesta del 24-sep) la
 * superficie es todo lo que cambia con el riel, y todas sus partes son
 * opcionales: context, toolbar, área central, columna lateral, dock. Una
 * superficie que necesita acciones arriba pone esta toolbar adentro de su área
 * de trabajo; una que no, no la pone, y no le cuesta alto a nadie.
 *
 * Hubo una fila fija en el chasis para esto y se quitó (4-oct-2026, ver el
 * comentario en `shell/Topbar.tsx`): medía alto en todas las pantallas y
 * ninguna superficie la llenaba. Los estilos quedaron en `shell/chrome.css` y
 * son los que usa este componente —sin estilos propios—:
 *
 * ```
 * .sw-toolbar            la fila
 * ├─ .sw-toolbar__seg    un grupo de botones (12px entre grupos, 4px adentro)
 * ├─ .sw-toolbar__sep    el separador de doble línea
 * ├─ .sw-toolbar__btn    un botón (--primary: el CTA · --solo: sólo ícono)
 * └─ .sw-toolbar__utiles el grupo empujado al canto derecho
 * ```
 */
export function Toolbar({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="sw-toolbar" role="toolbar" aria-label={label}>
      {children}
    </div>
  );
}

/** Un grupo: lo que se lee junto. El aire entre grupos es lo único que los separa si no hay `ToolbarSeparador`. */
export function ToolbarGrupo({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="sw-toolbar__seg">{children}</div>;
}

export function ToolbarSeparador(): React.ReactElement {
  return <span className="sw-toolbar__sep" aria-hidden="true" />;
}

/** El grupo de la derecha: lo que no es la acción principal de la superficie, sino un estado o una utilidad. */
export function ToolbarUtiles({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="sw-toolbar__utiles">{children}</div>;
}

export interface ToolbarBotonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** La acción principal de la superficie. Uno por toolbar. */
  primario?: boolean;
  /** Botón de sólo ícono: lleva borde, porque sin rótulo es lo único que dice «esto se aprieta». Exige `title`. */
  soloIcono?: boolean;
  /**
   * Un botón que alterna una vista (`aria-pressed`). Encendido se pinta como
   * primario: es la misma tinta que dice «esto es lo que está mandando ahora».
   */
  presionado?: boolean;
  title?: string;
}

export function ToolbarBoton({
  children,
  onClick,
  disabled,
  primario,
  soloIcono,
  presionado,
  title,
}: ToolbarBotonProps): React.ReactElement {
  const clases = ['sw-toolbar__btn'];
  if (primario || presionado) clases.push('sw-toolbar__btn--primary');
  if (soloIcono) clases.push('sw-toolbar__btn--solo');
  return (
    <button
      type="button"
      className={clases.join(' ')}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={soloIcono ? title : undefined}
      aria-pressed={presionado === undefined ? undefined : presionado}
    >
      {children}
    </button>
  );
}
