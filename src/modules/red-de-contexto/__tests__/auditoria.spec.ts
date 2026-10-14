import { describe, it, expect } from 'vitest';
import { bytesAMb, estadoDeRevision, etiquetaDeMotivo, mbABytes } from '../auditoria.js';

describe('auditor en pantalla', () => {
  it('cada motivo se lee en palabras; sin motivo, todavía lo está mirando el auditor', () => {
    expect(etiquetaDeMotivo('alcance')).toBe('Contenido de otra carpeta compartida');
    expect(etiquetaDeMotivo('formato')).toBe('Formato no admitido u oculto');
    expect(etiquetaDeMotivo(null)).toBe('Esperando al auditor');
  });

  it('cuarentena se ve como aviso, rechazado como peligro', () => {
    expect(estadoDeRevision('cuarentena').tono).toBe('warning');
    expect(estadoDeRevision('rechazado').tono).toBe('danger');
    expect(estadoDeRevision('aprobado').tono).toBe('success');
  });

  it('el umbral va y vuelve entre MB y bytes', () => {
    expect(bytesAMb(10 * 1024 * 1024)).toBe('10');
    expect(bytesAMb(1572864)).toBe('1.5');
    expect(mbABytes('10')).toBe(10 * 1024 * 1024);
    expect(mbABytes('1,5')).toBe(1572864);
    expect(mbABytes('0')).toBeNull();
    expect(mbABytes('abc')).toBeNull();
  });
});
