import { describe, it, expect } from 'vitest';
import { avanzar, partir, TECLA, AZAR, BORRA, LLENA, VACIA, type Avance } from '../useTipeo.js';

/**
 * La animación de las frases tiene que dar EL MISMO RESULTADO que el `tipeo()`
 * de `auth/login.js` del template — no una parecida.
 *
 * Es un test y no una revisión a ojo porque el modo de fallar es invisible: la
 * primera versión compilaba, typecheckeaba y arrancaba bien; escribía la
 * primera frase y se congelaba para siempre, que es algo que sólo se nota
 * mirando la pantalla más de tres segundos.
 *
 * La referencia de abajo es el `paso()` del template copiado tal cual. Si
 * alguna vez hay que cambiar la animación, se cambian LOS DOS y el test dice
 * exactamente en qué cuadro dejaron de coincidir.
 */

const FRASES = ['Hola mundo', 'Chau'];
const AZAR_FIJO = (): number => 0.5;

/* El paso() de auth/login.js, sin tocar. */
function referencia(frases: string[], pasos: number): { texto: [string, string][]; demoras: number[] } {
  const texto: [string, string][] = [];
  const demoras: number[] = [];
  let i = 0;
  let n = 0;
  let borrando = false;
  const pintar = (): void => {
    const f = frases[i];
    texto.push([f.slice(0, n), f.slice(n)]);
  };
  pintar();
  demoras.push(TECLA);
  for (let k = 0; k < pasos; k++) {
    const f = frases[i];
    if (!borrando) {
      if (n < f.length) {
        n++;
        pintar();
        demoras.push(TECLA + AZAR_FIJO() * AZAR);
        continue;
      }
      borrando = true;
      pintar();
      demoras.push(LLENA);
      continue;
    }
    if (n > 0) {
      n--;
      pintar();
      demoras.push(BORRA);
      continue;
    }
    borrando = false;
    i = (i + 1) % frases.length;
    pintar();
    demoras.push(VACIA);
  }
  return { texto, demoras };
}

function nuestro(frases: string[], pasos: number): { texto: [string, string][]; demoras: number[] } {
  const texto: [string, string][] = [];
  const demoras: number[] = [TECLA];
  let a: Avance = { i: 0, n: 0, borrando: false };
  const { escrito, falta } = partir(a, frases);
  texto.push([escrito, falta]);
  for (let k = 0; k < pasos; k++) {
    const r = avanzar(a, frases, AZAR_FIJO);
    a = r.avance;
    const v = partir(a, frases);
    texto.push([v.escrito, v.falta]);
    demoras.push(r.demora);
  }
  return { texto, demoras };
}

describe('el tipeo reproduce el del template', () => {
  it('emite la misma secuencia de texto a lo largo de dos frases enteras', () => {
    const pasos = 120;
    expect(nuestro(FRASES, pasos).texto).toEqual(referencia(FRASES, pasos).texto);
  });

  it('espera lo mismo en cada paso', () => {
    const pasos = 120;
    expect(nuestro(FRASES, pasos).demoras).toEqual(referencia(FRASES, pasos).demoras);
  });

  it('no se congela: da la vuelta y vuelve a empezar', () => {
    // El bug real que tuvo: llegar al final de la primera frase y no seguir.
    let a: Avance = { i: 0, n: 0, borrando: false };
    const vistas = new Set<number>();
    for (let k = 0; k < 400; k++) {
      a = avanzar(a, FRASES, AZAR_FIJO).avance;
      vistas.add(a.i);
    }
    expect([...vistas].sort()).toEqual([0, 1]);
  });

  it('con la frase entera se queda quieta, y ahí es donde espera más', () => {
    let a: Avance = { i: 0, n: 0, borrando: false };
    let r = avanzar(a, FRASES, AZAR_FIJO);
    while (r.demora !== LLENA) {
      a = r.avance;
      r = avanzar(a, FRASES, AZAR_FIJO);
    }
    // El paso que dispara la espera larga NO cambia lo que se ve: la frase ya
    // está entera y se queda así sus 2600 ms.
    expect(partir(a, FRASES)).toEqual(partir(r.avance, FRASES));
    expect(partir(r.avance, FRASES)).toEqual({ escrito: 'Hola mundo', falta: '' });
  });
});
