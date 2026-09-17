/* ============================================================================
   SpaceMyWork — El estado vacío
   ----------------------------------------------------------------------------
   La pantalla que se ve cuando una superficie de trabajo no tiene nada
   adentro: el campo de puntos, el título, la lista de lo que ya existe y las
   dos acciones.

   POR QUÉ ES UN ARCHIVO Y NO PARTE DE canvas.js, que es de donde salió. No
   tenía nada de canvas: ni una referencia a `graph`, ni a `view`, ni al plano
   — se comprobó línea por línea antes de moverlo. Vivía ahí porque el lienzo
   fue la primera superficie que lo necesitó, no porque le perteneciera.

   Lo que forzó la mudanza fue la segunda superficie. Documento tiene el mismo
   problema —entrar y que no haya nada abierto— y la alternativa era escribir
   otro vacío al lado, con otro tono y otra anatomía, para decir lo mismo. Un
   producto con dos estados vacíos distintos se lee como dos productos.

   LO QUE CAMBIA ENTRE SUPERFICIES ES EL TEXTO Y LA LISTA, no el componente.
   Por eso `montar()` recibe todo por parámetro y no sabe qué es un flujo ni
   qué es un documento.

   NO SE TOCÓ NADA DEL DIBUJO al mudarlo — el campo de puntos, su generador
   determinista y la razón de cada número están abajo, tal cual estaban. Se
   verificó con diferencia de píxeles contra la captura previa, en los dos
   temas: la mudanza no cambió un solo píxel.
   ============================================================================ */

(function () {
  'use strict';

  const ico = window.SW.icon;
  const esc = x => String(x)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');


  /* EL ENREJADO QUE REACCIONA AL PUNTERO se mudó a src/shell/ambience.js.

     No era del estado vacío: es la luz de fondo de una superficie de trabajo,
     y la hoja la pedía con documento abierto — o sea fuera del vacío. Vive con
     los orbes y el halo, que son sus hermanos.

     Acá se llama igual que siempre, sólo que por su nombre nuevo. */
  const campoVacio = (host, mount) => window.SW.ambiente.campo(host, mount);

  let figura = null;   // { destroy() } del gráfico del vacío — sólo existe con emptyEl

  /* Gráfico del estado vacío, arriba del título. Reemplaza a las tres manchas
     de puntos (design/vacio-grafico.html variante B). Referencia:
     capturas/animacion/animacion-c-2.mp4.

     LO QUE HACE, Y ES EL PUNTO ENTERO: se está DIBUJANDO. No es una figura
     quieta que gira — hay una cabeza que avanza por una curva 3D dejando una
     estela que se apaga, y cuando termina la vuelta la vuelve a empezar. La
     primera versión giraba una maraña completa y la lectura era otra: parecía
     un ovillo de pelos, no un nodo trazándose. Lo que da la sensación de
     dibujo es que el color lo mande la EDAD del tramo, no su profundidad.

     Cómo se arma: la curva se recorta en 28 tramos consecutivos, cada uno un
     <path> relleno con su propio color, pintados del más viejo al más nuevo —
     así lo recién trazado pasa por encima de lo anterior, como una lapicera.
     El grosor lo maneja la perspectiva (más ancho cerca de cámara) y las dos
     puntas se afinan hasta cero.

     Nada de esto es layout: se recalculan atributos de <path>, no se mueve
     ninguna caja (regla 7 de §11 — no necesita excepción anotada). Y sale más
     barato que las manchas: 56 atributos por cuadro contra los ~1.200 que
     escribían los 400 <circle>. Medido: 61 fps, y con prefers-reduced-motion
     dibuja un cuadro y se queda quieto.

     Sin texto y sin acento. Dos tokens y los dos se invierten solos entre
     claro y oscuro: --sw-text-2 para la tinta y --sw-ink, el fondo del
     lienzo, como el otro extremo de la estela. */
  function trazoVacio(mount) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sw-empty-canvas__figure');
    svg.setAttribute('viewBox', '0 0 350 350');
    svg.setAttribute('aria-hidden', 'true');
    mount.prepend(svg);

    /* TRAMOS. El trazo visible se parte en pedazos consecutivos y cada uno
       es un <path> con su propio color, pintados en orden: primero el más
       viejo, último el que se está dibujando. Así lo nuevo pasa por encima
       de lo viejo, que es lo que hace una lapicera de verdad.

       Y son RELLENOS, no trazos: el grosor tiene que cambiar a lo largo del
       recorrido —con la perspectiva y con las puntas— y stroke-width es
       constante por elemento. El contorno de la cinta se calcula a mano. */
    const TRAMOS = 28;
    const tramos = [];
    for (let i = 0; i < TRAMOS; i++) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('stroke', 'none');
      svg.appendChild(p);
      tramos.push(p);
    }
    /* La punta que dibuja es REDONDA, no una aguja. La cinta ya no se afina
       al llegar a la cabeza: termina en corte recto, a ancho pleno, y este
       círculo del mismo radio se lo tapa. Eso es una punta de lapicera; el
       afinado dejaba un pelo que no dibuja nada. Va último en el DOM, así
       queda por encima del trazo. */
    const punta = document.createElementNS(NS, 'circle');
    punta.setAttribute('stroke', 'none');
    svg.appendChild(punta);

    const quieto = matchMedia('(prefers-reduced-motion: reduce)');
    const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    let raf = 0, t0 = performance.now();

    const N = 280;        // muestras del trazo visible
    const CX = 175, CY = 175;
    const R = 88;         // radio de la esfera en unidades del viewBox
    const W = 5.8;        // semiancho de la cinta en el plano de cámara
    const CAM = 3.2;      // distancia de cámara: cuánta perspectiva hay
    const LARGO = 5.6;    // cuánto del patrón se ve a la vez, de 2π
    const VEL = 1.55;     // rad/s que avanza la cabeza

    /* Lissajous 3D de frecuencias 3:4:5 — la variante B de
       design/trazo-vacio.html, elegida contra otras siete. Es la única que
       da a la vez las dos cosas del original: silueta de bola y lazos
       grandes que se cruzan. Las que enrollan sobre una esfera daban una
       media luna; los nudos tóricos quedaban planos.

       El patrón se cierra cada 2π (las tres frecuencias son enteras), así
       que la cabeza lo recorre una y otra vez — igual que el original, que
       vuelve a dibujar la misma bola. La deriva lenta de fase evita que dos
       pasadas salgan idénticas. */
    function curva(t, T, out) {
      const x = Math.sin(3 * t + T * 0.05);
      const y = Math.sin(4 * t + 1.1);
      const z = Math.sin(5 * t + T * 0.04);
      /* CONTRA UN CASQUETE ESFÉRICO. Un Lissajous suelto llena un CUBO: la
         silueta sale angulosa y no se lee como bola por más que gire. Cada
         punto se empuja hacia radio ~1 sin aplastarlo del todo — el radio
         final queda entre 0,88 y 1,10, así que la forma hace de esfera pero
         respira y no queda de compás. */
      const r = Math.hypot(x, y, z) || 1;
      const f = (0.86 + 0.14 * r) / r;
      out[0] = x * f; out[1] = y * f; out[2] = z * f;
    }

    /* La escala se mide UNA vez sobre el patrón entero, no cuadro a cuadro
       sobre lo visible: si se recalculara con la ventana, la figura
       respiraría de tamaño mientras la cabeza avanza. */
    const cru = [0, 0, 0];
    let normMax = 1e-6;
    for (let i = 0; i < 900; i++) {
      curva(i / 900 * Math.PI * 2, 0, cru);
      const r = Math.hypot(cru[0], cru[1], cru[2]);
      if (r > normMax) normMax = r;
    }
    const ESC = 1 / normMax;

    const P = new Float64Array(N * 3);   // x, y, semiancho ya proyectados

    function calcular(T) {
      const cabeza = T * VEL;
      const ay = T * 0.50, ax = 0.40 * Math.sin(T * 0.27);
      const cy0 = Math.cos(ay), sy0 = Math.sin(ay);
      const cx0 = Math.cos(ax), sx0 = Math.sin(ax);

      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);                       // 0 = cola, 1 = cabeza
        curva(cabeza - (1 - u) * LARGO, T, cru);
        const x = cru[0] * ESC, y = cru[1] * ESC, z = cru[2] * ESC;
        const x1 =  x * cy0 + z * sy0, z1 = -x * sy0 + z * cy0;
        const y2 =  y * cx0 - z1 * sx0, z2 = y * sx0 + z1 * cx0;
        const k = CAM / (CAM - z2);                  // >1 cerca, <1 lejos
        P[i * 3]     = CX + x1 * R * k;
        P[i * 3 + 1] = CY + y2 * R * k;
        /* Sólo la COLA se afina, y hasta cero: la estela se disuelve en vez
           de terminar en un corte recto. La cabeza va a ancho pleno — la
           redondea el círculo de la punta, no un afinado. */
        P[i * 3 + 2] = W * k * Math.min(1, u / 0.22);
      }
    }

    /* El contorno de un tramo: se va por un lado sumando la normal y se
       vuelve por el otro restándola. La normal sale de la tangente por
       diferencias centradas — con la tangente hacia adelante nomás, la
       cinta se retuerce en las curvas cerradas. */
    function contorno(a, b) {
      let ida = '', vuelta = '';
      for (let i = a; i <= b; i++) {
        const j0 = Math.max(0, i - 1) * 3, j1 = Math.min(N - 1, i + 1) * 3;
        const tx = P[j1] - P[j0], ty = P[j1 + 1] - P[j0 + 1];
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len * P[i * 3 + 2], ny = tx / len * P[i * 3 + 2];
        const x = P[i * 3], y = P[i * 3 + 1];
        ida += (i === a ? 'M' : 'L') + (x + nx).toFixed(1) + ' ' + (y + ny).toFixed(1);
        vuelta = 'L' + (x - nx).toFixed(1) + ' ' + (y - ny).toFixed(1) + vuelta;
      }
      return ida + vuelta + 'Z';
    }

    function leerRGB(v) {
      if (v[0] === '#') {
        const h = v.length === 4
          ? v[1] + v[1] + v[2] + v[2] + v[3] + v[3]
          : v.slice(1, 7);
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
      const m = v.match(/[\d.]+/g) || [0, 0, 0];
      return [+m[0], +m[1], +m[2]];
    }

    function dibujar(now) {
      const T = (now - t0) / 1000;
      calcular(T);
      /* Neutro de TEXTO, no de filete: el gráfico tiene que leerse contra el
         lienzo, y --sw-line-strong está pensado para separar superficies, no
         para dibujar. El otro extremo es el fondo del lienzo. Los dos se
         invierten solos entre claro y oscuro y ninguno gasta acento. */
      const fondo = leerRGB(tok('--sw-ink')), tinta = leerRGB(tok('--sw-text-2'));
      const paso = (N - 1) / TRAMOS;

      for (let c = 0; c < TRAMOS; c++) {
        const a = Math.round(c * paso);
        const b = Math.round((c + 1) * paso);
        /* La EDAD manda el color, no la profundidad: lo recién dibujado va a
           tinta plena y la estela se apaga hacia el fondo. Eso es lo que
           hace que se lea como un trazo que avanza y no como una maraña
           quieta que gira. Elevado a 1,3 para que el brillo se concentre
           cerca de la cabeza sin que la estela se apague del todo: con el
           piso más bajo la bola quedaba deshilachada y perdía la silueta.
           Los rellenos son OPACOS: con alfa, dos tramos contiguos se pisan
           en el solape, el alfa se suma y aparecen parches rectangulares
           atravesando el trazo. */
        const s = 0.30 + 0.70 * Math.pow((c + 1) / TRAMOS, 1.3);
        tramos[c].setAttribute('d', contorno(a, Math.min(N - 1, b + 1)));
        tramos[c].setAttribute('fill', 'rgb(' +
          Math.round(fondo[0] + (tinta[0] - fondo[0]) * s) + ',' +
          Math.round(fondo[1] + (tinta[1] - fondo[1]) * s) + ',' +
          Math.round(fondo[2] + (tinta[2] - fondo[2]) * s) + ')');
      }

      const u = (N - 1) * 3;
      punta.setAttribute('cx', P[u].toFixed(1));
      punta.setAttribute('cy', P[u + 1].toFixed(1));
      punta.setAttribute('r', P[u + 2].toFixed(1));
      punta.setAttribute('fill', 'rgb(' + tinta[0] + ',' + tinta[1] + ',' + tinta[2] + ')');

      raf = requestAnimationFrame(dibujar);
    }
    function arrancar() { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(dibujar); } }
    function frenar() { cancelAnimationFrame(raf); raf = 0; }
    function unaVez() { dibujar(performance.now()); frenar(); }

    const onVis = () => document.hidden ? frenar() : (quieto.matches || arrancar());
    const onQuieto = () => { frenar(); quieto.matches ? unaVez() : arrancar(); };
    const onTema = () => { if (quieto.matches) unaVez(); };
    document.addEventListener('visibilitychange', onVis);
    quieto.addEventListener('change', onQuieto);
    const mo = new MutationObserver(onTema);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    quieto.matches ? unaVez() : arrancar();

    return {
      destroy() {
        frenar();
        document.removeEventListener('visibilitychange', onVis);
        quieto.removeEventListener('change', onQuieto);
        mo.disconnect();
        svg.remove();
      },
    };
  }

  /* --------------------------------------------------------------------------
     CAMPO DE PUNTOS DEL ESTADO VACIO — el dibujo, en CSS puro.

     Referencia: capturas/referencias/componentes/empty-state.mp4. Medido sobre
     dos cuadros de ese video, no estimado a ojo: diametros de 2 a 8px con el
     grueso en 3, repartidos en un racimo suelto, y brillos que van de la mitad
     del blanco a casi blanco.

     POR QUE CSS Y NO <canvas>: no hay interaccion. El campo no responde al
     cursor —el de la referencia tampoco—, asi que un bucle de requestAnimation-
     Frame estaria redibujando circulos para siempre a cambio de nada. El que SI
     necesita canvas es campoVacio(), el enrejado de fondo, porque ese si
     reacciona al puntero.

     OJO CON EL ARGUMENTO DE "CSS ES GRATIS", que es falso a medias y aca se
     midio: una animacion CSS solo se compone en el hilo grafico si toca
     UNICAMENTE transform y opacity Y NO MENCIONA NINGUNA CUSTOM PROPERTY. La
     primera version de este campo tenia var(--dx) adentro de los keyframes y
     costaba 182ms de recalculo de estilo cada 5 segundos — cuarenta veces mas
     que el <canvas> del enrejado, que sale 4ms. Ver marcaDelCampo().

     SOLO transform Y opacity (regla 7). Ninguna posicion se anima: la posicion
     la fija left/top una vez y lo que se mueve es una traslacion de pocos px.

     DETERMINISTA a proposito. El sorteo va con semilla fija, asi que el campo
     es el MISMO en cada carga y en cada captura. Un campo distinto cada vez
     haria que verify.mjs y los diffs de pixel midieran ruido en vez de deriva.
     -------------------------------------------------------------------------- */
  function camposDePuntos() {
    /* mulberry32 — generador chico y reproducible. La semilla es un numero
       cualquiera, pero es SIEMPRE el mismo numero. */
    let a = 0x9E3779B9;
    const rnd = () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const entre = (lo, hi) => lo + rnd() * (hi - lo);

    /* EL REPARTO DE TAMANOS es lo que hace que un campo denso siga siendo un
       campo y no un confeti: la mayoria es polvo de 1 a 2px y lo que se ve son
       unos pocos cuerpos con peso arrastrando una nube.

       Y LA CUENTA ES MAYOR QUE LO QUE SE VE. Como los puntos titilan, en
       cualquier momento hay un tercio por debajo del umbral de visibilidad:
       de estos 84 se ven unos 55 a la vez. */
    const TAMANOS = [
      ...Array(12).fill(0).map(() => entre(5, 8)),     // los cuerpos
      ...Array(24).fill(0).map(() => entre(3, 4.2)),   // los medianos
      ...Array(48).fill(0).map(() => entre(1.2, 2.4)), // el polvo
    ];

    const tope = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    return TAMANOS.map((d, i) => {
      /* Los grandes tiran al centro y los chicos se van a los bordes: es lo
         que hace que el racimo se lea como un racimo y no como una lluvia
         pareja. «sesgo» es 0 para el mas grande y 1 para el mas chico. */
      const sesgo = i / (TAMANOS.length - 1);
      /* % desde el centro. Arranca en 22 y no en 14: con el nucleo mas
         apretado los grandes se amontonaban en el medio y el campo se leia
         como una mancha con un agujero alrededor. */
      const radio = 22 + sesgo * 26;
      const ang = entre(0, Math.PI * 2);
      /* La deriva tiene su propia direccion, sin relacion con donde cayo el
         punto: si usara el mismo angulo, todo el campo se abriria o se
         cerraria como un iris. */
      const ang2 = entre(0, Math.PI * 2);
      /* El recorrido tiene que CABER en la caja. Con el reparto acotado al
         8-92% quedan 16px de aire de cada lado en una caja de 200, asi que una
         amplitud mayor a ~36px saca puntos afuera: medido, con 34-62px se
         salian 7 de 32. Y como no hay overflow:hidden no se recortan, se van
         a pasear — o sea que el dibujo dejaba de medir 200. */
      const ampl = entre(20, 36);
      /* Con tope: sin el, el punto mas excentrico se salia de la caja y
         quedaba cortado contra el borde. */
      return {
        x: +tope(50 + Math.cos(ang) * radio * entre(.6, 1.35), 8, 92).toFixed(2),
        y: +tope(50 + Math.sin(ang) * radio * entre(.6, 1.35), 9, 91).toFixed(2),
        d: +d.toFixed(2),
        /* Opacidad. El BRILLO VA CON EL TAMANO, que es lo que hace la
           referencia: los pocos grandes son los que casi llegan al blanco y
           el polvo se queda a media tinta. Al reves —o sin correlacion— el
           campo se lee como ruido parejo en vez de como un racimo con peso.

           o0 baja CASI A CERO a proposito: en la referencia los puntos no
           se atenuan, DESAPARECEN. Medido, en cada salto de medio segundo
           cambia el 36% del campo — el que aparece y el que se va son el
           movimiento principal, mas que la deriva. */
        o0: +entre(0, .05).toFixed(2),
        o1: +(.45 + (1 - sesgo) * .5 + entre(-.06, .06)).toFixed(2),
        /* Deriva: DIRECCION propia por punto, 20 a 36px de recorrido en 0,8 a
           1,7 segundos. Da del orden de 20 px/s.

           Este numero NO sale de medir la referencia, y conviene que quede
           escrito por que. La medicion del video daba 12,4 px/s de mediana,
           pero estaba inflada: con 36% de recambio por salto, el emparejador
           de puntos aparea puntos DISTINTOS entre cuadros y cuenta el salto
           como desplazamiento. Y aun corrigiendo eso, el campo calibrado
           contra ese numero se seguia leyendo quieto en pantalla.

           Asi que la referencia manda para la DENSIDAD y el reparto —eso si
           se mide bien de un video— y la velocidad esta puesta mirando la
           pantalla, que es donde se juzga el movimiento. Tres pasadas:
           0,6 px/s (parecia estatico), 4,9 px/s (seguia pareciendo lento),
           y esto. */
        dx: +(Math.cos(ang2) * ampl).toFixed(1),
        dy: +(Math.sin(ang2) * ampl).toFixed(1),
        /* DOS RELOJES, no uno. La deriva y el titileo corren en ciclos
           distintos y con desfases distintos: con un solo reloj el punto se
           apaga siempre en la misma punta del recorrido y el campo entero
           late al unisono, que es justo lo que delata el truco.

           El titileo no baja de 0,7s por ciclo: mas rapido que eso un punto
           empieza a parpadear en vez de aparecer, y aunque son chicos y de
           bajo contraste —lejos del umbral de la pauta 2.3.1— el campo pasa
           a leerse como ruido de television.

           Los desfases son NEGATIVOS para que al abrir la pantalla el campo
           ya este en movimiento y repartido, en vez de arrancar todos desde
           el mismo cuadro. */
        t: +entre(.8, 1.7).toFixed(2),
        r: +entre(0, 1.7).toFixed(2),
        u: +entre(.7, 1.5).toFixed(2),
        v: +entre(0, 1.5).toFixed(2),
      };
    });
  }

  /* Emite el campo: un <style> con los keyframes de cada punto, y los spans.

     POR QUE UN KEYFRAME POR PUNTO, en vez de uno solo con var(--dx) adentro
     —que es como estaba y es mucho mas corto de escribir—:

     UNA ANIMACION QUE MENCIONA UNA CUSTOM PROPERTY NO SE PUEDE COMPONER. El
     navegador no puede mandarla al hilo grafico, porque para saber a donde va
     el punto tiene que resolver var(--dx) en cada cuadro, y resolver variables
     es recalculo de estilo: hilo principal. Medido con Performance.getMetrics,
     5 segundos con el lienzo vacio:

       con var() en los keyframes .... 182ms de recalculo de estilo
       con keyframes literales ....... ver la medicion de abajo

     Los valores siguen saliendo del mismo generador determinista; lo unico
     que cambia es DONDE se escriben. El <style> va adentro del propio estado
     vacio y no en el <head>, asi se va con el cuando el lienzo deja de estar
     vacio — sin codigo de limpieza que se pueda olvidar. <style> es
     display:none por UA, asi que no cuenta como item del flex de .inner. */
  function marcaDelCampo() {
    const pts = camposDePuntos();

    const reglas = pts.map((p, i) =>
      '@keyframes sw-vd' + i + '{' +
        'from{transform:translate3d(0,0,0)}' +
        'to{transform:translate3d(' + p.dx + 'px,' + p.dy + 'px,0)}}' +
      '@keyframes sw-vt' + i + '{' +
        'from{opacity:' + p.o0 + '}' +
        'to{opacity:' + p.o1 + '}}'
    ).join('');

    const spans = pts.map((p, i) => {
      const medio = (p.d / 2).toFixed(2);
      return '<span style="' +
        'left:calc(' + p.x + '% - ' + medio + 'px);' +
        'top:calc(' + p.y + '% - ' + medio + 'px);' +
        'width:' + p.d + 'px;height:' + p.d + 'px;' +
        'opacity:' + p.o1 + ';' +
        /* Los NOMBRES son lo unico que cambia por punto. Duracion y desfase
           tambien van aca porque son dos valores por propiedad —uno para la
           deriva y otro para el titileo— y separarlos en CSS obligaria a otra
           variable, que es justo lo que se esta sacando. */
        'animation-name:sw-vd' + i + ',sw-vt' + i + ';' +
        'animation-duration:' + p.t + 's,' + p.u + 's;' +
        'animation-delay:-' + p.r + 's,-' + p.v + 's' +
      '"></span>';
    }).join('');

    return '<style>' + reglas + '</style>' +
      '<div class="sw-vacio-campo" aria-hidden="true">' + spans + '</div>';
  }


  /* --------------------------------------------------------------------
     MONTAR — la única puerta de entrada

     Va a haber UN ESTADO VACÍO POR SUPERFICIE DE TRABAJO: flujo, documento,
     tablero, código, tabla, métricas. Los seis son la misma pantalla con
     otro contenido, así que lo que varía entra por `spec` y el componente no
     sabe de qué superficie se trata.

     spec = {
       icono,                  // el de la sección, el mismo del riel
       title, body,            // qué está vacío y qué se puede hacer
       openLabel,              // nombre accesible de la lista
       files: [{ id, name, meta, icon }],
       create, editLast,       // las dos acciones
       onAbrir(id), onCrear(), onUltimo()   // opcionales: sin handler, inertes
     }

     `files` se pasa ya resuelto y no se lee de ningún lado: la lista de una
     superficie la conoce la superficie. Acá llegan tres o cuatro entradas ya
     elegidas, porque esto es un atajo a lo reciente y no un segundo panel.
     -------------------------------------------------------------------- */

  function montar(host, spec) {
    const t = spec || {};
    const files = t.files || [];

    const el = document.createElement('div');
    /* EN LÍNEA (`enLinea`): adentro de algo que ya tiene su caja —la fila vacía de
       una tabla—. Ocupa su lugar en el flujo en vez de flotar sobre un lienzo, y
       no monta el enrejado de fondo (más abajo). */
    el.className = 'sw-empty-canvas' + (t.enLinea ? ' sw-empty-canvas--enlinea' : '');

    /* Los archivos van como <a> y no como <button> a proposito: abren algo que
       ya existe, o sea que son NAVEGACION. Un boton promete que algo va a
       pasar acá; un enlace promete que te lleva a otro lado. El href queda en
       '#' mientras no haya rutas de verdad — el dia que las haya se cambia el
       dato, no el markup. */
    const archivo = f =>
      '<a class="sw-vacio-arch" href="#" data-archivo="' + esc(f.id) + '">' +
        ico(f.icon || 'doc') +
        '<span class="sw-vacio-arch__n">' + esc(f.name) + '</span>' +
        '<span class="sw-vacio-arch__m">' + esc(f.meta) + '</span>' +
      '</a>';

    /* EL EMPTY DE BASECOAT (`.empty`, el de shadcn — pedido del dueño): apilado
       y centrado. Arriba el dibujo con el ícono de la sección en el medio;
       debajo el título y la bajada, y en su <section> lo reciente y las dos
       salidas. Estuvo con el dibujo a la izquierda y el texto al lado, de la
       referencia; el dueño lo prefirió igual al vacío del chat.

       Las clases de adentro —título, bajada, recientes, salidas— son las de
       siempre: las usan canvas.css y las pruebas, y lo que cambió es la caja.

       La lista y las acciones se OMITEN si no vinieron, en vez de dibujarse
       vacías: una superficie que todavía no sabe listar nada no tiene que
       mostrar un hueco con un rótulo. */
    const hayAbajo = files.length || t.create || t.editLast;
    el.innerHTML =
      '<div class="empty sw-empty-canvas__inner">' +
        '<header>' +
          '<figure class="sw-empty-canvas__media" aria-hidden="true">' +
            marcaDelCampo() +
            (t.icono ? '<span class="sw-empty-canvas__icono">' + ico(t.icono) + '</span>' : '') +
          '</figure>' +
          '<h2 class="sw-empty-canvas__title">' + esc(t.title || '') + '</h2>' +
          '<p class="sw-empty-canvas__body">' + esc(t.body || '') + '</p>' +
        '</header>' +
        (hayAbajo ? '<section class="sw-empty-canvas__texto">' : '') +
          (files.length
            ? '<div class="sw-vacio-archivos" role="list" aria-label="' + esc(t.openLabel || '') + '">' +
                files.map(f => '<div role="listitem">' + archivo(f) + '</div>').join('') +
              '</div>'
            : '') +
          (t.create || t.editLast
            ? '<div class="sw-vacio-acciones">' +
                (t.create
                  ? '<button type="button" class="btn sw-vacio-crear" data-size="sm">' +
                    ico('plus') + '<span>' + esc(t.create) + '</span></button>' : '') +
                (t.editLast
                  ? '<button type="button" class="sw-vacio-editar">' +
                    ico('pen') + '<span>' + esc(t.editLast) + '</span></button>' : '') +
              '</div>'
            : '') +
        (hayAbajo ? '</section>' : '') +
      '</div>';

    /* UN SOLO LISTENER DELEGADO para las tres acciones. Los tres nodos se
       crean juntos y mueren juntos con `el`, así que no hace falta soltarlos
       de a uno: al removerlo, se van con él. */
    const alClick = ev => {
      const a = ev.target.closest('[data-archivo]');
      if (a) { ev.preventDefault(); if (t.onAbrir) t.onAbrir(a.dataset.archivo); return; }
      if (ev.target.closest('.sw-vacio-crear')) { if (t.onCrear) t.onCrear(); return; }
      if (ev.target.closest('.sw-vacio-editar')) { if (t.onUltimo) t.onUltimo(); }
    };
    el.addEventListener('click', alClick);

    host.appendChild(el);

    /* campoVacio recibe el HOST y no `el`. .sw-empty-canvas lleva
       pointer-events:none —para que el clic derecho siga llegando al lienzo—
       y ese `none` lo heredan sus hijos, así que un listener de MOVIMIENTO
       puesto adentro no dispararía nunca.

       El listener de click de arriba sí funciona, y no es una contradicción:
       .sw-empty-canvas__texto se devuelve el puntero con pointer-events:auto
       (canvas.css), así que los enlaces y botones reciben el clic y éste
       burbujea hasta acá. Lo que nunca llega a `el` es el puntero moviéndose
       sobre las zonas que siguen en `none` — que es justo lo que el campo
       necesita seguir. */
    /* En línea no hay enrejado: adentro de una tarjeta, un campo de puntos sería
       un segundo material, y la grilla es de la caja de trabajo (regla 10). */
    const campo = t.enLinea ? null : campoVacio(host, el);

    return {
      el,
      /* REMEDIR. El campo de puntos escucha `resize` de la ventana, pero no
         que su contenedor cambie de ancho — y eso pasa cada vez que se abre o
         se colapsa la columna lateral, sin que la ventana se entere. Quien
         sabe que su caja cambió lo avisa; el componente no adivina. */
      refresh() { if (campo) campo.refresh(); },
      destroy() {
        if (campo) campo.destroy();
        if (figura) { figura.destroy(); figura = null; }
        el.removeEventListener('click', alClick);
        el.remove();
      },
    };
  }

  /* `marca` se publica para que el vacío del chat use EL MISMO dibujo (pedido del
     dueño). Duplicarlo sería tener dos campos de puntos que se parecen y se
     desincronizan: el generador es determinista y los keyframes se escriben
     literales, así que lo único que hace falta compartir es esta función. */
  window.SW.vacio = { montar, marca: marcaDelCampo };
})();
