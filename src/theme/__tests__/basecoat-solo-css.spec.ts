import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * De Basecoat usamos el CSS y NADA MÁS.
 *
 * Su JS muta el DOM por detrás de React —medido sobre el bundle del template:
 * 45 setAttribute, 14 classList y 4 innerHTML—, así que convive mal con el
 * árbol que React cree controlar. El comportamiento (foco, teclado, Escape,
 * ARIA, abierto/cerrado) lo pone Radix, que hace lo mismo DESDE React.
 *
 * Esto es un test y no un comentario porque el fallo sería silencioso: un
 * `import 'basecoat-css/dropdown-menu'` compila verde y rompe en runtime, de a
 * ratos, sólo cuando React y la librería tocan el mismo nodo.
 */

const SRC = resolve(__dirname, '../..');

function archivosDeCodigo(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    // Los propios tests quedan afuera: este archivo nombra los imports
    // prohibidos para explicarlos, y se encontraria a si mismo.
    if (entrada === 'node_modules' || entrada === '__tests__') continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      salida.push(...archivosDeCodigo(ruta));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entrada)) {
      salida.push(ruta);
    }
  }
  return salida;
}

describe('Basecoat entra sólo como CSS', () => {
  it('ningún archivo importa JS de basecoat', () => {
    // Los exports de JS del paquete: 'basecoat-css/basecoat', '/all', '/select',
    // '/dialog', etc. El de CSS es el import a secas o '/components', y esos
    // viven en styles-tailwind.css, que este barrido no mira.
    const culpables = archivosDeCodigo(SRC)
      .filter((f) => /from\s+['"]basecoat-css|require\(['"]basecoat-css|import\s+['"]basecoat-css/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1));

    expect(culpables).toEqual([]);
  });

  /**
   * Lo que la librería emitiría sola y Radix no: sin JS de Basecoat, los
   * atributos de los que cuelga su CSS los tiene que poner nuestro markup.
   *
   * `data-value` es el que CUENTA las opciones:
   *
   *   .select:not(select) [role=listbox]:not([data-empty])
   *     :not(:has([data-value]:not([aria-hidden=true])))::before
   *     { content: "No results found" }
   *
   * Sin él, todo combo abría con «No results found» arriba de sus opciones,
   * que estaban ahí. Es test y no comentario por lo mismo que el de arriba: el
   * fallo es silencioso —compila verde y se ve mal— y el atributo parece
   * redundante al lado del `value` de Radix, así que es exactamente de los que
   * alguien saca por prolijidad.
   */
  it('las opciones del combo llevan los atributos que el CSS de Basecoat mira', () => {
    const combo = readFileSync(join(SRC, 'components/ui/Combo.tsx'), 'utf8');
    const item = /<Select\.Item\s[^>]*>/.exec(combo)?.[0] ?? '';
    expect(item).toContain('data-value=');
    // El del check de la opción elegida, por el mismo motivo.
    expect(item).toContain('aria-selected=');
  });

  it('el CSS de Basecoat sí está enganchado, y por los dos entries', () => {
    // El entry por default resuelve a base + tema: sin '/components' las 39
    // clases no salen, y falla en silencio (compila verde, sin .card ni .dialog).
    const cadena = readFileSync(join(SRC, 'styles-tailwind.css'), 'utf8');
    expect(cadena).toContain('@import "basecoat-css";');
    expect(cadena).toContain('@import "basecoat-css/components";');
  });
});
