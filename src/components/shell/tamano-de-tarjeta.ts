/**
 * EL TAMAÑO DE LA TARJETA DEL CHAT — sólo datos → datos, para poder fijarlo
 * con un test (`vitest.config.ts`: lógica pura, sin jsdom).
 *
 * ## Por qué un solo número
 *
 * El tamaño se guarda como UN ancho y el alto sale de la proporción. No son
 * dos ejes independientes a propósito: la tarjeta tiene que crecer «en igual
 * proporción de alto y ancho», así que un segundo grado de libertad sería un
 * estado que nadie puede elegir y que habría que mantener consistente.
 *
 * ## Dónde está el punto fijo
 *
 * La tarjeta está anclada con `place-self: end end`, así que su esquina
 * INFERIOR DERECHA es la única que no se mueve al cambiar de tamaño — es la
 * misma geometría de la que sale `transform-origin: bottom right`. De ahí que
 * la manija viva en la esquina OPUESTA: tirando de la superior izquierda, la
 * tarjeta crece hacia el centro de la pantalla y el ancla se queda sola, sin
 * una línea de JS que la reponga.
 *
 * > DESVIACIÓN DECLARADA DEL TEMPLATE. Su decisión 49 dice de la tarjeta
 * > flotante: «No sube, no baja y no se redimensiona», porque el punto del
 * > modo flotante es dejar el lienzo a la vista. Acá se redimensiona por
 * > pedido del dueño, y lo que se conserva de esa decisión es lo que la
 * > sostenía: la tarjeta sigue anclada a su esquina y tiene techo —nunca
 * > tapa el lienzo entero—, así que sigue sin poder ir a parar al medio.
 */

/** Los de `--sw-flota-w` / `--sw-flota-h` en `tokens.css`. */
export const ANCHO_BASE = 420;
export const ALTO_BASE = 560;

/** 4:3. El alto se deriva del ancho y no al revés porque el gesto es horizontal. */
export const RATIO = ALTO_BASE / ANCHO_BASE;

/**
 * Más angosta que esto el composer deja de poder usarse: sus controles son de
 * ancho fijo y el campo de texto es lo único que encoge.
 */
export const ANCHO_MINIMO = 320;

/** Dónde se recuerda. Un ancho en px; el alto sale de `altoDe`. */
export const TAMANO_KEY = 'sw.chat.ancho';

export function altoDe(ancho: number): number {
  return Math.round(ancho * RATIO);
}

/** La celda del lienzo, que es el espacio que la tarjeta puede ocupar. */
export interface Hueco {
  ancho: number;
  alto: number;
  /** El respiro contra la esquina — `--sw-s-4`, el mismo del `translate`. */
  respiro: number;
}

/**
 * EL TECHO LO PONE EL HUECO, Y POR LOS DOS EJES.
 *
 * Con proporción fija, el eje que primero se queda sin lugar gobierna a los
 * dos: una ventana baja y ancha tiene que frenar el ancho, aunque de ancho
 * sobre. Si no, el `max-height` del CSS recorta el alto por su cuenta y la
 * tarjeta deja de ser proporcional sin que nadie lo haya pedido.
 */
export function anchoMaximo({ ancho, alto, respiro }: Hueco): number {
  const porAncho = ancho - respiro * 2;
  const porAlto = (alto - respiro * 2) / RATIO;
  return Math.max(ANCHO_MINIMO, Math.floor(Math.min(porAncho, porAlto)));
}

export function limitarAncho(ancho: number, hueco: Hueco): number {
  return Math.round(Math.min(anchoMaximo(hueco), Math.max(ANCHO_MINIMO, ancho)));
}

/**
 * EL GESTO EN UN SOLO NÚMERO: la proyección del movimiento sobre la diagonal
 * de la tarjeta.
 *
 * Con la proporción fija, el puntero y la esquina sólo pueden ir juntos si el
 * gesto va exactamente por la diagonal; en cualquier otra dirección hay que
 * elegir qué parte del movimiento cuenta. Proyectar es la elección que no
 * privilegia un eje: tirar en diagonal mueve la esquina con el dedo, y tirar
 * sólo hacia arriba o sólo hacia la izquierda también agranda —menos—, que es
 * lo que la gente intenta primero.
 *
 * Tomar el eje dominante (`max(dx, dy)`) era la alternativa y se siente peor:
 * el tamaño salta al cruzar la diagonal, porque la componente que mandaba
 * cambia de golpe.
 *
 * `dx`/`dy` son POSITIVOS HACIA EL CENTRO: la manija está arriba a la
 * izquierda, así que mover hacia la izquierda y hacia arriba es agrandar.
 */
export function anchoDelGesto(anchoAlEmpezar: number, dx: number, dy: number): number {
  return anchoAlEmpezar + (dx + RATIO * dy) / (1 + RATIO * RATIO);
}
