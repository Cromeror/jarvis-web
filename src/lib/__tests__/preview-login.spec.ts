/**
 * La puerta de los previews (`PreviewLoginPage`) y la vuelta del login que la
 * hace posible. Lo que se fija acá es lo que no se ve al probar a mano: que el
 * `next` del login no sea un redirector abierto, y que un `rd` roto no salga
 * ni a pedirle permiso al server.
 */
import { describe, expect, it } from 'vitest';
import { loginConVuelta, rutaDeVueltaSegura } from '../ruta-de-vuelta.js';
import { mensajeDeErrorDelGrant, validarRd } from '../preview-auth-api.js';

describe('rutaDeVueltaSegura', () => {
  it('acepta una ruta interna con query y hash', () => {
    const rd = encodeURIComponent('https://moto-ops-dev.gdomgroup.com/ventas?x=1');
    expect(rutaDeVueltaSegura(`/preview-login?rd=${rd}`)).toBe(`/preview-login?rd=${rd}`);
    expect(rutaDeVueltaSegura('/plans/jarvis#arriba')).toBe('/plans/jarvis#arriba');
  });

  it.each([
    ['absoluta', 'https://evil.com/'],
    ['protocol-relative', '//evil.com/x'],
    ['barra invertida', '/\\evil.com'],
    ['tab que el parser descarta', '/\t/evil.com'],
    ['salto de línea', '/\n/evil.com'],
    ['javascript:', 'javascript:alert(1)'],
    ['sin barra', 'plans'],
    ['vacía', ''],
    ['no string', 42],
  ])('rechaza %s', (_caso, raw) => {
    expect(rutaDeVueltaSegura(raw)).toBeNull();
  });

  it('no vuelve al login: sería un loop', () => {
    expect(rutaDeVueltaSegura('/login')).toBeNull();
    expect(rutaDeVueltaSegura('/login?next=%2Fplans')).toBeNull();
  });
});

describe('loginConVuelta', () => {
  it('lleva la ruta codificada en next', () => {
    expect(loginConVuelta('/preview-login?rd=https%3A%2F%2Fa.b%2F')).toBe(
      '/login?next=%2Fpreview-login%3Frd%3Dhttps%253A%252F%252Fa.b%252F',
    );
  });

  it('el caso común (/) y lo que no pasa el filtro quedan en /login pelado', () => {
    expect(loginConVuelta('/')).toBe('/login');
    expect(loginConVuelta('//evil.com')).toBe('/login');
  });

  it('ida y vuelta: lo que se codifica se recupera igual', () => {
    const ruta = '/preview-login?rd=https%3A%2F%2Fmoto-ops-dev.gdomgroup.com%2Fa%3Fb%3D1';
    const next = new URL(loginConVuelta(ruta), 'https://jarvis.x').searchParams.get('next');
    expect(rutaDeVueltaSegura(next)).toBe(ruta);
  });
});

describe('validarRd', () => {
  it('acepta una URL https', () => {
    expect(validarRd('https://moto-ops-dev.gdomgroup.com/ventas')).toEqual({
      ok: true,
      rd: 'https://moto-ops-dev.gdomgroup.com/ventas',
    });
  });

  it('sin rd: falta el enlace', () => {
    expect(validarRd(null)).toEqual({ ok: false, error: 'Falta el enlace del entorno.' });
    expect(validarRd('  ')).toEqual({ ok: false, error: 'Falta el enlace del entorno.' });
  });

  it.each(['http://moto-ops-dev.gdomgroup.com/', 'javascript:alert(1)', 'no es una url', '/relativa'])(
    'rechaza %s sin llamar al server',
    (rd) => {
      expect(validarRd(rd).ok).toBe(false);
    },
  );
});

describe('mensajeDeErrorDelGrant', () => {
  it('403 y 404 con texto propio, no el del server', () => {
    expect(mensajeDeErrorDelGrant(403, '{"message":"Forbidden"}')).toBe('Tu usuario no tiene acceso a este proyecto.');
    expect(mensajeDeErrorDelGrant(404, '{"message":"x no es un preview"}')).toBe('Ese enlace no es un entorno de Jarvis.');
  });

  it('400 muestra el mensaje del server', () => {
    const cuerpo = JSON.stringify({ message: 'Los previews se sirven sólo por HTTPS.', error: 'Bad Request', statusCode: 400 });
    expect(mensajeDeErrorDelGrant(400, cuerpo)).toBe('Los previews se sirven sólo por HTTPS.');
    expect(mensajeDeErrorDelGrant(400, JSON.stringify({ message: ['a', 'b'] }))).toBe('a b');
    expect(mensajeDeErrorDelGrant(400, '<html>')).toBe('El enlace del entorno no es válido.');
  });

  it('otro status: genérico con el código', () => {
    expect(mensajeDeErrorDelGrant(502, '')).toBe('No se pudo abrir el entorno (HTTP 502).');
  });
});
