import React from 'react';
import '../theme/islas/icons.js';

/**
 * El port de `window.SW.icon()` — el registro NO se toca, sólo cambia cómo se
 * emite el `<svg>`: en vanilla era una string, acá es un componente.
 *
 * Se lee del helper y no del registro crudo porque el helper es el que decide
 * la clase (las marcas llevan `sw-ico--marca` además de `sw-ico`). Duplicar esa
 * decisión acá sería un segundo lugar donde equivocarse cuando el template
 * agregue una marca nueva.
 *
 * No hay elemento envoltorio, y es deliberado: las clases de Basecoat
 * seleccionan por descendencia (`.input-group > svg`, `.btn > svg`), así que un
 * `<span>` de más entre medio corta la cadena y el ícono pierde su regla.
 */

const VACIO = { clase: 'sw-ico', shape: '' };

function partir(name: string): { clase: string; shape: string } {
  const html = window.SW?.icon?.(name);
  if (!html) return VACIO;
  return {
    clase: /class="([^"]*)"/.exec(html)?.[1] ?? 'sw-ico',
    shape: html.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''),
  };
}

/* TypeScript deja pasar `data-*` sueltos sobre etiquetas nativas, pero no sobre
   un componente: hay que declararlos. Los usa Basecoat para variar el relleno
   del ícono segun de que lado del boton va (`data-icon="inline-end"`). */
type Datos = { [K in `data-${string}`]?: string };

export function Icon({
  name,
  className = '',
  ...resto
}: { name: string; className?: string } & React.SVGProps<SVGSVGElement> & Datos): React.ReactElement | null {
  const { clase, shape } = partir(name);
  if (!shape) return null;
  return (
    <svg
      className={`${clase} ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...resto}
      /* El shape sale de nuestro propio registro vendorizado, no de datos de
         usuario: es la única vía razonable de inyectar un path sin reescribir
         los 109 íconos como JSX. */
      dangerouslySetInnerHTML={{ __html: shape }}
    />
  );
}
