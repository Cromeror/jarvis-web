import { describe, expect, it } from 'vitest';
import {
  projectIdDeLaUrl,
  resolverProyectoActivo,
  rutaAlCambiarDeProyecto,
} from '../proyecto-activo.js';

describe('projectIdDeLaUrl', () => {
  it('lo saca de las secciones que lo llevan', () => {
    expect(projectIdDeLaUrl('/chat/acme')).toBe('acme');
    expect(projectIdDeLaUrl('/chat/acme/sesion-1')).toBe('acme');
    expect(projectIdDeLaUrl('/paquetes/acme/facturacion/emision')).toBe('acme');
  });

  it('devuelve null donde el segundo segmento no es un proyecto', () => {
    expect(projectIdDeLaUrl('/')).toBeNull();
    expect(projectIdDeLaUrl('/users')).toBeNull();
    expect(projectIdDeLaUrl('/plan-runs/r1')).toBeNull();
    // La sección sin proyecto: `/chat` es el selector, no un proyecto.
    expect(projectIdDeLaUrl('/chat')).toBeNull();
  });
});

describe('resolverProyectoActivo', () => {
  // El cliente trabaja EN un proyecto; el operador los administra todos. Sólo el
  // primero tiene una pertenencia que permita elegir por él.
  const cliente = { autoElegirUnico: true };
  const operador = { autoElegirUnico: false };

  it('la URL le gana a la preferencia guardada', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: 'acme', guardado: 'otro', accesibles: ['acme', 'otro'], ...cliente }),
    ).toBe('acme');
  });

  it('AL CLIENTE con un solo proyecto se le elige solo', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: null, accesibles: ['acme'], ...cliente }),
    ).toBe('acme');
  });

  it('AL OPERADOR no, aunque haya uno solo: no es su lugar de trabajo, es lo que administra', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: null, accesibles: ['acme'], ...operador }),
    ).toBeNull();
  });

  it('el operador sí conserva lo que eligió explícitamente', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: 'acme', accesibles: ['acme', 'otro'], ...operador }),
    ).toBe('acme');
  });

  it('con varios y sin elección no adivina, sea quien sea', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: null, accesibles: ['acme', 'otro'], ...cliente }),
    ).toBeNull();
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: null, accesibles: ['acme', 'otro'], ...operador }),
    ).toBeNull();
  });

  it('respeta lo guardado mientras siga siendo accesible', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: 'otro', accesibles: ['acme', 'otro'], ...cliente }),
    ).toBe('otro');
  });

  it('descarta lo guardado si ya no es accesible, y el cliente cae al único que queda', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: 'viejo', accesibles: ['acme'], ...cliente }),
    ).toBe('acme');
  });

  it('descarta lo guardado si ya no es accesible y hay varios: hay que volver a elegir', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: 'viejo', accesibles: ['acme', 'otro'], ...cliente }),
    ).toBeNull();
  });

  it('sin proyectos accesibles no hay proyecto activo', () => {
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: 'viejo', accesibles: [], ...cliente }),
    ).toBeNull();
  });

  it('con la lista todavía en vuelo conserva lo guardado en vez de descartarlo', () => {
    // `null` es «no sé», y es distinto de `[]`: descartar acá haría parpadear el
    // menú en cada arranque, entre que la lista sale y vuelve.
    expect(
      resolverProyectoActivo({ deLaUrl: null, guardado: 'acme', accesibles: null, ...cliente }),
    ).toBe('acme');
  });
});

describe('rutaAlCambiarDeProyecto', () => {
  it('vuelve a la raíz de la superficie, no al mismo objeto', () => {
    expect(rutaAlCambiarDeProyecto('/chat/viejo/sesion-1', 'nuevo')).toBe('/chat/nuevo');
    expect(rutaAlCambiarDeProyecto('/workspaces/viejo/ws-1/diff', 'nuevo')).toBe(
      '/workspaces/nuevo',
    );
  });

  it('un paquete cae al inicio: su ruta entera es del proyecto anterior', () => {
    expect(rutaAlCambiarDeProyecto('/paquetes/viejo/facturacion/emision', 'nuevo')).toBe('/');
  });

  it('una ruta sin proyecto se queda donde está', () => {
    expect(rutaAlCambiarDeProyecto('/', 'nuevo')).toBe('/');
    expect(rutaAlCambiarDeProyecto('/users', 'nuevo')).toBe('/users');
  });
});
