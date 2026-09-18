import { describe, expect, it } from 'vitest';
import {
  moduloDeLaRuta,
  rutaDeAterrizaje,
  superficiesDe,
  superficieDeLaRuta,
} from '../superficies-del-riel.js';
import type { CatalogSuite } from '../catalog-api.js';

const suite = (slug: string, modulos: string[]): CatalogSuite => ({
  id: slug,
  slug,
  name: slug.toUpperCase(),
  description: null,
  modules: modulos.map((m) => ({
    id: m,
    slug: m,
    name: m.toUpperCase(),
    description: null,
    module_tools: [
      {
        id: `${m}-util`,
        slug: `${m}-util`,
        name: `util-${m}`,
        description: null,
        tool_name: null,
        key: null,
        origin: 'manual' as const,
        status: 'active' as const,
        compatible_with: null,
        created_at: '',
        updated_at: '',
      },
    ],
    key: null,
    origin: 'manual' as const,
    status: 'active' as const,
    accepts: 'any' as const,
    created_at: '',
    updated_at: '',
  })),
  created_at: '',
  updated_at: '',
});

describe('superficiesDe — son dos rieles disjuntos, no uno con recortes', () => {
  it('EL CLIENTE VE SUS SUITES Y NADA MÁS', () => {
    const s = superficiesDe({
      suites: [suite('facturacion', ['emision'])],
      projectId: 'acme',
      esOperador: false,
    });
    expect(s.map((x) => x.id)).toEqual(['/suites/facturacion']);
  });

  it('ni Dashboard, ni la maquinaria, ni la administración', () => {
    const ids = superficiesDe({
      suites: [suite('facturacion', ['emision'])],
      projectId: 'acme',
      esOperador: false,
    }).map((x) => x.id);
    for (const ajeno of ['/', '/plans', '/environments', '/workspaces', '/users', '/catalogo']) {
      expect(ids).not.toContain(ajeno);
    }
  });

  it('un cliente sin suites habilitadas se queda con el riel VACÍO', () => {
    // No es un menú roto: el chat flotante está en todas las pantallas y no se
    // navega. Lo que no hay es a dónde ir, que es lo que efectivamente pasa.
    expect(superficiesDe({ suites: [], projectId: 'acme', esOperador: false })).toEqual([]);
  });

  it('sin ámbito tampoco hay suites: la pregunta no tiene sujeto', () => {
    expect(
      superficiesDe({ suites: [suite('facturacion', ['emision'])], projectId: null, esOperador: false }),
    ).toEqual([]);
  });

  it('EL OPERADOR VE LA MAQUINARIA Y LA ADMINISTRACIÓN, y no suites', () => {
    const s = superficiesDe({
      suites: [suite('facturacion', ['emision'])],
      projectId: 'acme',
      esOperador: true,
    });
    expect(s.map((x) => x.id)).toEqual([
      '/',
      '/plans',
      '/environments',
      '/workspaces',
      '/catalogo',
      '/users',
    ]);
    expect(s.filter((x) => x.alPie).map((x) => x.id)).toEqual(['/catalogo', '/users']);
  });

  it('el riel NO lleva Chat: el chat es el panel flotante de la derecha', () => {
    const ids = superficiesDe({ suites: [], projectId: 'acme', esOperador: true }).map((s) => s.id);
    expect(ids).not.toContain('/chat');
  });

  it('las herramientas del operador entran directo y no listan nada', () => {
    const s = superficiesDe({ suites: [], projectId: 'acme', esOperador: true });
    expect(s.every((x) => x.directa)).toBe(true);
    expect(s.every((x) => x.modulos === undefined)).toBe(true);
  });

  it('con ámbito elegido, la herramienta lleva el proyecto adentro del destino', () => {
    const s = superficiesDe({ suites: [], projectId: 'acme', esOperador: true });
    expect(s.find((x) => x.id === '/plans')?.to).toBe('/plans/acme');
    expect(s.find((x) => x.id === '/')?.to).toBe('/');
  });

  it('sin ámbito, la herramienta cae a la ruta pelada', () => {
    const s = superficiesDe({ suites: [], projectId: null, esOperador: true });
    expect(s.find((x) => x.id === '/plans')?.to).toBe('/plans');
  });

  it('la suite trae sus módulos, y cada módulo sus herramientas', () => {
    const s = superficiesDe({
      suites: [suite('facturacion', ['emision', 'cobros'])],
      projectId: 'acme',
      esOperador: false,
    });
    const laSuite = s.find((x) => x.id === '/suites/facturacion');
    expect(laSuite?.to).toBe('/suites/acme/facturacion');
    expect(laSuite?.modulos?.map((m) => m.id)).toEqual([
      '/suites/acme/facturacion/emision',
      '/suites/acme/facturacion/cobros',
    ]);
    expect(laSuite?.modulos?.[0]?.herramientas.map((h) => h.name)).toEqual(['util-emision']);
  });
});

describe('superficieDeLaRuta', () => {
  const delCliente = superficiesDe({
    suites: [suite('facturacion', ['emision'])],
    projectId: 'acme',
    esOperador: false,
  });
  const delOperador = superficiesDe({ suites: [], projectId: 'acme', esOperador: true });

  it('el módulo abierto marca a SU suite', () => {
    expect(superficieDeLaRuta('/suites/acme/facturacion/emision', delCliente)?.id).toBe(
      '/suites/facturacion',
    );
  });

  it('una herramienta con proyecto en la ruta marca la herramienta', () => {
    expect(superficieDeLaRuta('/plans/acme', delOperador)?.id).toBe('/plans');
  });

  it('Y LA MISMA HERRAMIENTA SIN PROYECTO TAMBIÉN: el destino lleva ámbito, el match no', () => {
    expect(superficieDeLaRuta('/plans', delOperador)?.id).toBe('/plans');
    expect(superficieDeLaRuta('/workspaces', delOperador)?.id).toBe('/workspaces');
  });

  it('el Dashboard es exacto: no se lleva todas las rutas por ser prefijo', () => {
    expect(superficieDeLaRuta('/', delOperador)?.id).toBe('/');
  });

  it('una ruta que no es de ninguna superficie cae a la primera', () => {
    expect(superficieDeLaRuta('/plan-runs/r1', delOperador)?.id).toBe('/');
  });

  it('con el riel vacío no hay superficie que marcar, y no revienta', () => {
    expect(superficieDeLaRuta('/lo-que-sea', [])).toBeUndefined();
  });
});

describe('moduloDeLaRuta', () => {
  const s = superficiesDe({
    suites: [suite('facturacion', ['emision'])],
    projectId: 'acme',
    esOperador: false,
  });

  it('encuentra el módulo abierto y de qué suite es', () => {
    const r = moduloDeLaRuta('/suites/acme/facturacion/emision', s);
    expect(r?.modulo.slug).toBe('emision');
    expect(r?.suite.id).toBe('/suites/facturacion');
  });

  it('en la suite sin módulo en la URL cae al primero, igual que la página', () => {
    // La página muestra el primer módulo cuando la ruta no dice cuál. Si la caja
    // devolviera null acá, el centro mostraría un módulo y la derecha diría que
    // no hay ninguno — la misma pantalla contando dos cosas distintas.
    const r = moduloDeLaRuta('/suites/acme/facturacion', s);
    expect(r?.modulo.slug).toBe('emision');
  });

  it('fuera de todo suite no hay caja de herramientas', () => {
    expect(moduloDeLaRuta('/plans/acme', s)).toBeNull();
  });

  it('un slug que la navegación no devolvió NUNCA se devuelve: cae al primero real', () => {
    // La ruta puede existir; lo que decide es lo que la API haya habilitado. Y
    // el fallback es el mismo de `SuitePage`, que con un slug desconocido
    // también muestra el primer módulo — si acá diera null, la misma pantalla
    // contaría dos cosas distintas.
    const r = moduloDeLaRuta('/suites/acme/facturacion/ajeno', s);
    expect(r?.modulo.slug).toBe('emision');
    expect(r?.modulo.slug).not.toBe('ajeno');
  });
});

describe('rutaDeAterrizaje', () => {
  it('el cliente aterriza en su primera suite, no en el Dashboard', () => {
    const s = superficiesDe({
      suites: [suite('facturacion', ['emision']), suite('nomina', ['liquidacion'])],
      projectId: 'acme',
      esOperador: false,
    });
    expect(rutaDeAterrizaje(s)).toBe('/suites/acme/facturacion');
  });

  it('el operador aterriza en el Dashboard, que es lo suyo', () => {
    const s = superficiesDe({ suites: [], projectId: 'acme', esOperador: true });
    expect(rutaDeAterrizaje(s)).toBe('/');
  });

  it('sin nada habilitado no hay destino: no se inventa uno', () => {
    expect(rutaDeAterrizaje([])).toBeNull();
  });

  it('la administración no cuenta como aterrizaje: está al pie por algo', () => {
    const soloPie = superficiesDe({ suites: [], projectId: 'acme', esOperador: true }).filter(
      (x) => x.alPie,
    );
    expect(rutaDeAterrizaje(soloPie)).toBeNull();
  });
});

describe('el borde con la API: `moduleTool` se traduce a `herramienta` acá y no antes', () => {
  const s = superficiesDe({
    suites: [suite('facturacion', ['emision'])],
    projectId: 'acme',
    esOperador: false,
  });
  const h = s[0]?.modulos?.[0]?.herramientas?.[0];

  it('la tool que la respalda viaja como `toolName`, no como `tool_name`', () => {
    expect(h?.toolName).toBeNull();
  });

  it('y la fila cruda se conserva, para quien tenga que hablarle de vuelta a la API', () => {
    expect(h?.cruda.id).toBe('emision-util');
  });
});
