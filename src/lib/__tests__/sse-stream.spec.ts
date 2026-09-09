/**
 * El transporte SSE sobre `fetch`.
 *
 * Lo que se verifica acá es lo que se tuvo que reponer a mano al dejar
 * `EventSource`: el parseo del protocolo y la reconexión. Con `EventSource` las
 * dos venían del browser, así que no había nada que testear — y son
 * exactamente las dos cosas cuya ausencia no se nota hasta que el chat se queda
 * mudo en producción.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseSseBlock, delayDeReconexion, openSseStream } from '../sse-stream.js';

/** Un `Response` con cuerpo streameado a partir de los chunks dados. */
function respuestaStream(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  return {
    ok: status >= 200 && status < 300,
    status,
    body: new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(encoder.encode(ch));
        c.close();
      },
    }),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('parseSseBlock', () => {
  it('devuelve el payload de una línea data:', () => {
    expect(parseSseBlock('data: {"kind":"busy"}')).toBe('{"kind":"busy"}');
  });

  it('une varias líneas data: con salto de línea, como manda el formato', () => {
    expect(parseSseBlock('data: a\ndata: b')).toBe('a\nb');
  });

  it('ignora el campo event: y quedan sólo los datos', () => {
    expect(parseSseBlock('event: ping\ndata: 1')).toBe('1');
  });

  it('un bloque sin data: no es un evento', () => {
    // Es el caso del heartbeat (`: keep-alive`). Devolver '' haría que cada
    // latido despertara al consumidor con un JSON.parse('') que tira.
    expect(parseSseBlock(': keep-alive')).toBeNull();
    expect(parseSseBlock('event: ping')).toBeNull();
  });

  it('respeta un data: sin espacio después de los dos puntos', () => {
    expect(parseSseBlock('data:sin-espacio')).toBe('sin-espacio');
  });
});

describe('delayDeReconexion', () => {
  it('crece exponencialmente y tiene tope', () => {
    expect(delayDeReconexion(0)).toBe(1000);
    expect(delayDeReconexion(1)).toBe(2000);
    expect(delayDeReconexion(2)).toBe(4000);
    // Sin tope, un backend caído un rato largo llevaría la espera a horas y el
    // stream no volvería solo aunque el server ya estuviera sano.
    expect(delayDeReconexion(50)).toBe(30_000);
  });
});

describe('openSseStream', () => {
  it('entrega cada evento completo y no los parciales', async () => {
    // El corte de los chunks NO coincide con el de los eventos: es el caso
    // real de una red que parte el payload al medio.
    const fetchDoble = vi.fn().mockResolvedValue(
      respuestaStream(['data: {"a"', ':1}\n\ndata: {"b":2}\n\n']),
    );
    vi.stubGlobal('fetch', fetchDoble);

    const vistos: string[] = [];
    const s = openSseStream('/api/x', { onMessage: (d) => vistos.push(d) });
    await vi.waitFor(() => expect(vistos.length).toBe(2));
    s.close();

    expect(vistos).toEqual(['{"a":1}', '{"b":2}']);
    // Ruta relativa: el origen y el token los pone el interceptor de fetch.
    expect(fetchDoble.mock.calls[0]?.[0]).toBe('/api/x');
  });

  it('normaliza CRLF, que es un separador válido del formato', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaStream(['data: uno\r\n\r\n'])));
    const vistos: string[] = [];
    const s = openSseStream('/api/x', { onMessage: (d) => vistos.push(d) });
    await vi.waitFor(() => expect(vistos).toEqual(['uno']));
    s.close();
  });

  it('reconecta cuando el server cierra el stream', async () => {
    const fetchDoble = vi
      .fn()
      .mockResolvedValueOnce(respuestaStream(['data: 1\n\n']))
      .mockResolvedValue(respuestaStream(['data: 2\n\n']));
    vi.stubGlobal('fetch', fetchDoble);

    const vistos: string[] = [];
    const abiertas: number[] = [];
    const s = openSseStream('/api/x', {
      onMessage: (d) => vistos.push(d),
      onOpen: () => abiertas.push(1),
    });

    // Un cierre limpio del server también cuenta como caída: para un stream que
    // debe vivir mientras la vista esté abierta, quedarse callado es la falla.
    await vi.waitFor(() => expect(vistos).toEqual(['1']));
    await vi.waitFor(() => expect(abiertas.length).toBeGreaterThan(1), { timeout: 3000 });
    s.close();

    expect(vistos).toContain('2');
  });

  it('close() corta el stream y no reconecta', async () => {
    const fetchDoble = vi.fn().mockResolvedValue(respuestaStream(['data: 1\n\n']));
    vi.stubGlobal('fetch', fetchDoble);

    const s = openSseStream('/api/x', { onMessage: () => undefined });
    await vi.waitFor(() => expect(fetchDoble).toHaveBeenCalled());
    s.close();
    const llamadas = fetchDoble.mock.calls.length;

    // Si el close no cancelara el reintento agendado, esto seguiría creciendo
    // para siempre — una vista cerrada dejaría un stream reconectando solo.
    await new Promise((r) => setTimeout(r, 1500));
    expect(fetchDoble.mock.calls.length).toBe(llamadas);
  });

  it('una respuesta de error no rompe: avisa y reintenta', async () => {
    const fetchDoble = vi
      .fn()
      .mockResolvedValueOnce(respuestaStream([], 503))
      .mockResolvedValue(respuestaStream(['data: ok\n\n']));
    vi.stubGlobal('fetch', fetchDoble);

    const errores: unknown[] = [];
    const vistos: string[] = [];
    const s = openSseStream('/api/x', {
      onMessage: (d) => vistos.push(d),
      onError: (e) => errores.push(e),
    });
    await vi.waitFor(() => expect(errores.length).toBe(1));
    await vi.waitFor(() => expect(vistos).toEqual(['ok']), { timeout: 3000 });
    s.close();
  });
});
