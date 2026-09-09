import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Que `origen-de-la-api.feature` y su spec digan lo mismo.
 *
 * Mismo mecanismo que `feature-scenario-parity.spec.ts`, con una diferencia que
 * es el motivo de que este archivo exista aparte: aquel está atado a
 * `authorization.feature` y a una lista fija de specs de autorización, y
 * agregarle este contrato arrastraría los `it()` de las siete suites a la
 * comparación inversa. Acá el sujeto es un solo contrato con un solo spec.
 *
 * `@pendiente` SÍ se admite, al revés que en el parity de storage, porque este
 * archivo nace declarando deuda: los Escenarios describen el borde HTTP, que
 * hoy no filtra. La etiqueta tiene que significar lo mismo en las dos
 * direcciones — un pendiente que ya tiene test es un pendiente al que hay que
 * sacarle la etiqueta — o se vuelve decoración y el feature deja de decir qué
 * falta.
 *
 * El spec todavía no existe y eso NO es un fallo: mientras cada Escenario esté
 * marcado, la lista de exigibles está vacía y este parity pasa. Se pone rojo
 * solo en cuanto alguien saque un `@pendiente` sin escribir su `it()`.
 */
const AQUI = dirname(fileURLToPath(import.meta.url));
const FEATURE = join(AQUI, 'origen-de-la-api.feature');
/**
 * El spec que implementa los Escenarios de este contrato.
 *
 * Fue una lista de dos mientras la web vivía en `packages/web-app`: la mitad
 * del front se verificaba en ese paquete. Al salir a su propio repo, ese
 * segundo spec dejó de ser alcanzable —y un parity que no encuentra sus `it()`
 * se pone rojo por una razón que no es la que importa—, así que el contrato se
 * partió: la Regla D se especifica y se verifica en `jarvis-web`.
 */
const SPEC = join(AQUI, 'api-origin.spec.ts');

interface Escenario {
  titulo: string;
  pendiente: boolean;
}

function escenarios(texto: string): Escenario[] {
  const lineas = texto.split('\n');
  const out: Escenario[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = /^\s*(?:Scenario|Escenario)(?:\s+Outline)?:\s*(.+?)\s*$/.exec(lineas[i] as string);
    if (!m) continue;
    // Las etiquetas de un Escenario son las de la línea inmediatamente anterior.
    const tags = (lineas[i - 1] ?? '').trim();
    out.push({ titulo: m[1] as string, pendiente: /(^|\s)@pendiente(\s|$)/.test(tags) });
  }
  return out;
}

function its(texto: string): string[] {
  return [...texto.matchAll(/\bit(?:\.(?:skip|only|fails))?\(\s*(['"`])([\s\S]*?)\1/g)].map((m) => m[2] as string);
}

describe('paridad entre origen-de-la-api.feature y sus it()', () => {
  const delFeature = existsSync(FEATURE) ? escenarios(readFileSync(FEATURE, 'utf8')) : [];
  const delSpec = existsSync(SPEC) ? its(readFileSync(SPEC, 'utf8')) : [];
  const exigibles = delFeature.filter((e) => !e.pendiente);

  it('el feature existe y tiene Escenarios', () => {
    // El modo de falla más silencioso: un parser que dejó de matchear hace que
    // todo lo de abajo pase sobre listas vacías.
    expect(existsSync(FEATURE)).toBe(true);
    expect(delFeature.length).toBeGreaterThan(0);
  });

  it('todo Escenario exigible tiene su it() con el mismo título', () => {
    const sinIt = exigibles.filter((e) => !delSpec.includes(e.titulo)).map((e) => e.titulo);
    expect(sinIt).toEqual([]);
  });

  it('todo it() del spec figura como Escenario', () => {
    const titulos = new Set(delFeature.map((e) => e.titulo));
    expect(delSpec.filter((t) => !titulos.has(t))).toEqual([]);
  });

  it('un Escenario @pendiente todavía no tiene su it()', () => {
    const yaHechos = delFeature.filter((e) => e.pendiente && delSpec.includes(e.titulo)).map((e) => e.titulo);
    expect(yaHechos).toEqual([]);
  });
});
