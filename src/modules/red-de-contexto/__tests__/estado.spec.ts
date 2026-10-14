import { describe, it, expect } from 'vitest';
import { estadoDeMiembro, estadoEnLaCarpeta, slugDeNombre, slugValido, publicadosPorProyecto, tamano } from '../estado.js';

const hace = (ms: number): string => new Date(Date.now() - ms).toISOString();

describe('estadoDeMiembro', () => {
  it('sin el módulo o sin carpeta no participa, y eso va antes que cualquier error del sync', () => {
    const conError = { sincronizado_at: null, ultimo_error: 'El proyecto no tiene el módulo…' };
    expect(estadoDeMiembro(conError, { con_modulo: false, tiene_root: true }).etiqueta).toBe('Sin la red');
    expect(estadoDeMiembro(conError, { con_modulo: true, tiene_root: false }).etiqueta).toBe('Sin carpeta');
  });

  it('nunca sincronizado: pendiente si no hay error, «no sincroniza» si lo hay', () => {
    expect(estadoDeMiembro({ sincronizado_at: null, ultimo_error: null }).tono).toBe('neutral');
    const e = estadoDeMiembro({ sincronizado_at: null, ultimo_error: 'sudo: a password is required' });
    expect(e).toMatchObject({ tono: 'danger', etiqueta: 'No sincroniza' });
    expect(e.detalle).toContain('sudo');
  });

  it('sincronizado con un aviso no es una falla: se ve el aviso y cuándo anduvo', () => {
    const e = estadoDeMiembro({ sincronizado_at: hace(5 * 60_000), ultimo_error: '1 archivo(s) no se comparten: a.exe' });
    expect(e).toMatchObject({ tono: 'warning', etiqueta: 'Con aviso' });
    expect(e.detalle).toMatch(/Sincronizado hace 5m\. 1 archivo/);
  });

  it('sincronizado y sin nada que decir', () => {
    expect(estadoDeMiembro({ sincronizado_at: hace(1000), ultimo_error: null }, { con_modulo: true, tiene_root: true })).toEqual({
      tono: 'success',
      etiqueta: 'Sincronizado',
      detalle: 'Sincronizado ahora',
    });
  });
});

describe('slugDeNombre', () => {
  it('es un nombre de carpeta: sin tildes, minúsculas, guiones', () => {
    expect(slugDeNombre('Diseño & Producto')).toBe('diseno-producto');
    expect(slugDeNombre('  Área técnica / API  ')).toBe('area-tecnica-api');
    expect(slugDeNombre('---')).toBe('');
  });

  it('lo que produce pasa la validación del backend', () => {
    for (const n of ['Diseño & Producto', 'x'.repeat(100), 'Ñandú 2026']) {
      expect(slugValido(slugDeNombre(n)), n).toBe(true);
    }
    expect(slugValido('')).toBe(false);
    expect(slugValido('../x')).toBe(false);
    expect(slugValido('-x')).toBe(false);
  });
});

describe('publicadosPorProyecto', () => {
  it('agrupa por proyecto y ordena por ruta', () => {
    const p = (project_id: string, ruta: string) => ({ circulo_id: 'c', project_id, ruta, sha256: '', bytes: 1, mtime_ms: 0 });
    const m = publicadosPorProyecto([p('web', 'z.md'), p('dev', 'a.md'), p('web', 'a/b.md')]);
    expect(m.get('web')!.map((x) => x.ruta)).toEqual(['a/b.md', 'z.md']);
    expect(m.get('dev')!.map((x) => x.ruta)).toEqual(['a.md']);
  });
});

describe('tamano', () => {
  it('B, KB y MB, sin decimales de más', () => {
    expect(tamano(512)).toBe('512 B');
    expect(tamano(2048)).toBe('2 KB');
    expect(tamano(1536)).toBe('1.5 KB');
    expect(tamano(10 * 1024 * 1024)).toBe('10 MB');
  });
});

describe('estadoEnLaCarpeta', () => {
  const base = { sincronizado_at: null, ultimo_error: null, nota: null };
  it('una invitación pendiente espera a la organización: no se habla de sync', () => {
    expect(estadoEnLaCarpeta({ ...base, estado: 'pendiente' })).toMatchObject({ etiqueta: 'Pendiente de aprobación', tono: 'info' });
  });
  it('una rechazada dice por qué, con su propio ícono', () => {
    expect(estadoEnLaCarpeta({ ...base, estado: 'rechazada', nota: 'Datos de clientes' })).toMatchObject({
      etiqueta: 'Rechazada',
      icono: 'x',
      detalle: 'La organización la rechazó: Datos de clientes',
    });
  });
  it('aprobada, es el estado del sync de siempre', () => {
    expect(estadoEnLaCarpeta({ ...base, estado: 'aprobada' }).etiqueta).toBe('Pendiente');
  });
});
