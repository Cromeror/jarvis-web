import React from 'react';

/**
 * UN CHIP POR GRUPO, segmentado —quién | qué tiene—:
 *
 *     Miembros MOD-0006 │ roles · members · create      (un módulo y sus permisos)
 *     Jarvis agent      │ Contable · Colaborador        (un proyecto y sus roles)
 *
 * Reemplaza a «un chip por cada par»: con eso, saber cuántos roles tiene una
 * persona en un proyecto —o cuántos permisos da un módulo— obligaba a contar
 * chips que repetían el mismo nombre. Agrupado se lee de un vistazo, y la
 * fila crece por grupos y no por pares.
 *
 * El contraste es más alto que el de la tabla (`--sw-line-strong`, el rótulo
 * teñido con el acento, los ítems sobre `card`): con el borde normal el chip se
 * perdía contra el fondo de la fila en el tema oscuro.
 */
export function ChipDeGrupo({
  rotulo,
  codigo,
  items,
  title,
  neutro = false,
}: {
  /** Lo que se reconoce primero: el módulo, el proyecto. */
  rotulo: React.ReactNode;
  /** Un identificador chico al lado del rótulo (`MOD-0006`). */
  codigo?: string;
  /** Lo que tiene el grupo. Vacío se dice, no se deja en blanco. */
  items: React.ReactNode[];
  /** El detalle, para el que pasa el mouse. */
  title?: string;
  /** Rótulo sin el tinte del acento: lo transversal (Plataforma) o lo heredado. */
  neutro?: boolean;
}): React.ReactElement {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-stretch overflow-hidden rounded-md border border-[var(--sw-line-strong)] text-[11px] leading-none shadow-sm"
    >
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 font-medium ${
          neutro ? 'bg-accent text-foreground' : 'bg-primary/25 text-foreground'
        }`}
      >
        {rotulo}
        {codigo ? <code className="text-[10px] font-normal text-secondary-foreground">{codigo}</code> : null}
      </span>
      <span className="inline-flex flex-wrap items-center gap-x-1 border-l border-[var(--sw-line-strong)] bg-card px-2 py-1 text-foreground">
        {items.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          items.map((it, n) => (
            <React.Fragment key={n}>
              {n > 0 ? <span className="text-muted-foreground">·</span> : null}
              <span>{it}</span>
            </React.Fragment>
          ))
        )}
      </span>
    </span>
  );
}
