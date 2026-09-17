/* ============================================================================
   SpaceMyWork — Ambiente de la superficie de trabajo
   ----------------------------------------------------------------------------
   La luz de fondo: el halo suave, los orbes de color y la grilla que se
   enciende cerca del cursor.

   ES DE LA CAJA, NO DEL MÓDULO — la misma razón por la que la grilla punteada
   la pone `.sw-grid-surface` y no cada superficie (regla 10). El lienzo nodal
   fue el primero en tenerla y por eso vivía escrita adentro de canvas.js, pero
   no tiene nada de canvas: ni `graph`, ni `view`, ni el plano.

   Lo forzó la segunda superficie. La hoja se veía plana al lado de Flujos —sin
   orbes, sin halo, sin el punteado que responde al mouse— y la alternativa era
   copiar el efecto. Dos copias del mismo adorno es una que se olvida de
   actualizar.

   LOS NOMBRES DE CLASE SIGUEN DICIENDO `sw-canvas__*` y se dejan así a
   propósito: el markup del lienzo los tiene escritos en index.html y su CSS en
   canvas.css. Renombrarlos era tocar tres archivos para no ganar nada hoy.
   Queda anotado, que es distinto de que pase inadvertido.
   ============================================================================ */

(function () {
  'use strict';

  /* --------------------------------------------------------------------
     LAS CAPAS QUIETAS — halo y orbes. Puro CSS, sin una línea de JS: no
     reaccionan a nada, son luz de fondo.
     -------------------------------------------------------------------- */
  /* EL ORDEN IMPORTA y no lo fija ningún z-index: las tres son `absolute` sin
     z, así que la que va después en el DOM queda encima. De abajo hacia
     arriba: el halo, los orbes, y la grilla reactiva. Es el mismo orden que
     tiene escrito el lienzo en index.html.

     Se insertan como un bloque ANTES del contenido, no de a una con prepend:
     prepend de a una las deja al revés, que es justo lo que no se ve hasta que
     los orbes tapan el halo. */
  function capas(host, cuales) {
    const frag = document.createDocumentFragment();
    const hechas = [];
    for (const cls of cuales) {
      if (host.querySelector('.' + cls)) continue;   // el lienzo ya las trae
      const d = document.createElement('div');
      d.className = cls;
      d.setAttribute('aria-hidden', 'true');
      frag.appendChild(d);
      hechas.push(d);
    }
    host.prepend(frag);
    return hechas;
  }

  /* --------------------------------------------------------------------
     LA GRILLA REACTIVA — el halo persigue al mouse con un pequeño retraso
     (lerp por cuadro) en vez de saltar a la posición exacta: se siente
     seguido, no calcado. Sólo mouse —táctil no tiene hover que animar— y
     nada de esto corre bajo prefers-reduced-motion: no es sólo la
     transición de opacity la que se apaga, el propio seguimiento no debe
     arrancar.

     Es puro adorno: no puede costarle nada al trabajo real. Dos frenos, uno
     de arranque y uno en marcha:
     1. navigator.deviceMemory (si el navegador lo informa) descarta de
        entrada un equipo que ya se declara con poca RAM — no llega a
        intentarlo.
     2. Un vigía mide la duración real de cada cuadro. Diez cuadros seguidos
        por debajo de ~25fps —sea por esto o por cualquier otra cosa que esté
        pasando en la página— apagan el efecto para el resto de la sesión. No
        importa de quién es la culpa: es decorativo, así que es lo primero que
        se sacrifica.
     -------------------------------------------------------------------- */
  const POCA_RAM = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2;

  function seguir(host, fx) {
    if (!fx || POCA_RAM ||
        matchMedia('(prefers-reduced-motion: reduce)').matches ||
        matchMedia('(hover: none)').matches) {
      return { destroy() {} };
    }

    const D = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--sw-grid-fx-d')) || 260;
    const LENTO_MS = 40;      // peor que ~25fps cuenta como cuadro lento
    const LENTO_TOPE = 10;    // diez seguidos: se apaga solo, no vuelve a intentar

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    let ultimo = 0, lentos = 0;

    function apagar() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      fx.classList.remove('is-active');
      host.removeEventListener('mouseenter', entrar);
      host.removeEventListener('mousemove', mover);
      host.removeEventListener('mouseleave', salir);
    }

    function pintar(t) {
      if (ultimo) {
        lentos = (t - ultimo) > LENTO_MS ? lentos + 1 : 0;
        if (lentos >= LENTO_TOPE) { apagar(); return; }
      }
      ultimo = t;
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      const pos = (cx - D / 2) + 'px ' + (cy - D / 2) + 'px';
      fx.style.maskPosition = pos;
      fx.style.webkitMaskPosition = pos;
      raf = requestAnimationFrame(pintar);
    }

    function entrar(e) {
      const r = host.getBoundingClientRect();
      cx = tx = e.clientX - r.left;
      cy = ty = e.clientY - r.top;
      fx.classList.add('is-active');
      if (!raf) { ultimo = 0; lentos = 0; raf = requestAnimationFrame(pintar); }
    }
    function mover(e) {
      const r = host.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
    }
    function salir() {
      fx.classList.remove('is-active');
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    host.addEventListener('mouseenter', entrar);
    host.addEventListener('mousemove', mover);
    host.addEventListener('mouseleave', salir);
    return { destroy: apagar };
  }

  /* --------------------------------------------------------------------
     EL ENREJADO QUE REACCIONA AL PUNTERO — los puntos se apartan y se
     encienden cerca del cursor.

     Puerto directo de design/bloque-de-trabajo.html (campoVacio(), al final
     de su <script>): esa es la especificación validada, no una
     reinterpretación.

     NO ES LO MISMO QUE .sw-canvas__fx. Esa capa enciende con una máscara CSS
     los puntos que ya están dibujados, alineada con el pan y el zoom porque
     comparte background-size y background-position con el punteado base. Una
     máscara no puede hacer que los puntos FLOTEN y se aparten — por eso esto
     es un <canvas> aparte.

     Y por eso las dos no se montan juntas: son dos halos sobre el mismo
     punteado (decisión 40). Cada superficie elige una.
     -------------------------------------------------------------------- */
  /* LA MALLA — una variante, no otro componente. `op.malla` une cada punto con
     el de la derecha y el de abajo, y `op.paso` nombra el token que separa los
     puntos (por defecto, --sw-grid-step). La pidió la pantalla de entrar y es
     SOLO de ella: el lienzo y la hoja llaman sin opciones y dibujan lo mismo que
     antes, en el mismo orden.

     Es variante y no copia por todo lo que este componente ya aprendió a golpes
     —el buffer que se desfasaba del mouse, el tema, el movimiento reducido, el
     freno por poca RAM—: una segunda versión tendría que volver a aprenderlo. */
  function campo(host, mount, op) {
    const o = op || {};
    const MALLA = !!o.malla;
    /* UNO POR SUPERFICIE DE TRABAJO, y el guard va acá y no en quien llama.

       La hoja monta el enrejado de forma permanente y el estado vacío monta
       el suyo: cuando el vacío aparecía sobre la hoja quedaban DOS <canvas>
       de puntos encima, casi alineados hasta que el cursor los empujaba y se
       veían dobles.

       El primer intento puso el guard en empty-state.js preguntándole al host, y
       no alcanzaba: ahí el host es la ZONA que scrollea y el enrejado del
       ambiente vive en el MARCO, que es su padre. Preguntando desde acá por
       la caja de superficie entera, el chequeo vale para los dos y para
       cualquiera que venga. */
    const caja = mount.closest('[data-slot="surface"]') || mount.parentElement || mount;
    if (caja.querySelector('.sw-empty-canvas__field')) {
      return { refresh() {}, destroy() {} };
    }

    const cv = document.createElement('canvas');
    cv.className = 'sw-empty-canvas__field';
    mount.prepend(cv);
    const ctx = cv.getContext('2d');
    const quieto = matchMedia('(prefers-reduced-motion: reduce)');
    let pts = [], W = 0, H = 0, dpr = 1, raf = 0, t0 = performance.now();
    /* Lo de la malla: el paso vigente, cuántas columnas tiene cada fila, y las
       posiciones ya deformadas de cada punto, que las líneas necesitan ANTES de
       dibujar los puntos encima. */
    let paso = 32, cols = 0, grosor = 1, PX = null, PY = null, PK = null;
    let mx = -1e4, my = -1e4, mv = 0;   // mv: cuánta influencia tiene el cursor

    const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    let colBase = tok('--sw-grid-dot'), colAcc = tok('--sw-accent'), colVivo = tok('--sw-grid-dot-lit');

    function armar() {
      const r = host.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paso = parseInt(tok(o.paso || '--sw-grid-step')) || 32;
      pts = [];
      const punto = (x, y) => pts.push({
        x, y, f: Math.random() * Math.PI * 2,
        /* uno de cada treinta lleva acento: es el estado vacío, la
           única pantalla donde no compite con nada */
        acc: Math.random() < 0.033,
      });
      if (MALLA) {
        /* LA MALLA SE PASA DE LOS BORDES una fila y una columna por lado, y va
           centrada. Si arrancara en el primer paso como el enrejado, las líneas
           terminarían antes del canto y se vería el borde de la red; y al
           empujarlas el mouse, se despegarían dejando una franja vacía. */
        const x0 = (W % paso) / 2 - paso, y0 = (H % paso) / 2 - paso;
        cols = 0;
        for (let x = x0; x <= W + paso; x += paso) cols++;
        for (let y = y0; y <= H + paso; y += paso)
          for (let x = x0; x <= W + paso; x += paso) punto(x, y);
        PX = new Float32Array(pts.length);
        PY = new Float32Array(pts.length);
        PK = new Float32Array(pts.length);
      } else {
        for (let y = paso; y < H; y += paso)
          for (let x = paso; x < W; x += paso) punto(x, y);
      }
      colBase = tok('--sw-grid-dot'); colAcc = tok('--sw-accent'); colVivo = tok('--sw-grid-dot-lit');
      /* La línea de la malla es el filete del sistema: delgada quiere decir un
         píxel, no un número elegido para esta pantalla. */
      grosor = parseFloat(tok('--sw-border')) || 1;
    }

    function dibujar(now) {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      /* EL RADIO Y EL EMPUJE ESCALAN CON EL PASO en la malla. Con los números
         del enrejado —130px y 13— sobre puntos a 64, el cursor movía dos o tres
         nodos un quinto de su separación: la red apenas se torcía. A tres pasos
         de radio y dos quintos de paso de empuje, la deformación se lee como una
         lente que atraviesa la malla. */
      const R = MALLA ? paso * 3 : 130, R2 = R * R;
      const EMPUJE = MALLA ? paso * 0.4 : 13;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        let dx = 0, dy = 0, k = 0;
        if (mv > 0.01) {
          const ax = p.x - mx, ay = p.y - my, d2 = ax * ax + ay * ay;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1;
            k = (1 - d / R) * mv;
            dx = (ax / d) * k * EMPUJE; dy = (ay / d) * k * EMPUJE;
          }
        }
        /* la respiración: chica, lenta y con fase propia, para que el campo
           no lata al unísono */
        const b = quieto.matches ? 0 : 1;
        dx += Math.cos(t * 0.55 + p.f) * 1.4 * b;
        dy += Math.sin(t * 0.47 + p.f * 1.3) * 1.4 * b;

        /* en reposo el punto es EXACTAMENTE el de la grilla: el token ya
           trae su propio alfa, así que multiplicarlo otra vez lo apagaba.
           El realce se suma como una segunda pasada, sólo cerca del cursor.

           VA CON --sw-grid-dot-lit Y NO CON --sw-raised-2, y esto era un bug
           de tema. --sw-raised-2 es el escalón más alto de las superficies:
           en OSCURO eso queda por encima del lienzo y el punto se enciende,
           que era la intención. Pero en CLARO el escalón más alto es casi
           blanco, así que el punto —que en reposo es tinta al 11%— se pintaba
           de blanco encima: en vez de resaltarse, se DESVANECÍA hacia el
           fondo. El halo dejaba un hueco donde debería haber marca.

           --sw-grid-dot-lit ya existía y ya estaba resuelto por tema para
           exactamente esto: blanco al 53,7% en oscuro, tinta al 45,5% en
           claro. O sea que el punto se separa del lienzo en los dos, cada
           uno para el lado que corresponde en su tema.

           Lo consumía sólo la máscara CSS de .sw-canvas__fx —que en el vacío
           está apagada por la decisión 40—, así que el campo de puntos nunca
           lo había visto. */
        const X = p.x + dx, Y = p.y + dy, r = 1 + k * 1.4;
        /* En la malla no se dibuja todavía: las líneas van debajo de los
           puntos, así que primero se juntan todas las posiciones. */
        if (MALLA) { PX[i] = X; PY[i] = Y; PK[i] = k; continue; }
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.acc ? colAcc : colBase;
        ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832); ctx.fill();
        if (k > 0.02) {
          ctx.globalAlpha = k * 0.9;
          ctx.fillStyle = p.acc ? colAcc : colVivo;
          ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832); ctx.fill();
        }
      }
      if (MALLA) malla();
      ctx.globalAlpha = 1;
      mv += ((mx > -1e3 ? 1 : 0) - mv) * 0.08;
      raf = requestAnimationFrame(dibujar);
    }

    /* LA MALLA: cada punto se une con el de la derecha y el de abajo. Las líneas
       salen de las posiciones YA DEFORMADAS, y por eso se doblan con los puntos
       sin un cálculo propio.

       TRES PASADAS, en este orden. Todas las líneas en UN solo trazo: con el
       color de la grilla, que ya trae su alfa, un trazo único no se oscurece
       donde dos segmentos se tocan. Después el realce de las que pasan cerca
       del cursor, con el mismo color de encendido que los puntos. Y los puntos
       arriba de todo: sobre la línea, el nodo se lee como nodo. */
    function malla() {
      const n = pts.length;
      ctx.lineWidth = grosor;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colBase;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if ((i + 1) % cols) { ctx.moveTo(PX[i], PY[i]); ctx.lineTo(PX[i + 1], PY[i + 1]); }
        if (i + cols < n) { ctx.moveTo(PX[i], PY[i]); ctx.lineTo(PX[i + cols], PY[i + cols]); }
      }
      ctx.stroke();

      if (mv > 0.01) {
        ctx.strokeStyle = colVivo;
        const tramo = (i, j) => {
          const k = Math.max(PK[i], PK[j]);
          if (k <= 0.02) return;
          ctx.globalAlpha = k * 0.7;
          ctx.beginPath(); ctx.moveTo(PX[i], PY[i]); ctx.lineTo(PX[j], PY[j]); ctx.stroke();
        };
        for (let i = 0; i < n; i++) {
          if ((i + 1) % cols) tramo(i, i + 1);
          if (i + cols < n) tramo(i, i + cols);
        }
      }

      for (let i = 0; i < n; i++) {
        const p = pts[i], k = PK[i];
        /* Un poco más grandes que los del enrejado: con el doble de separación,
           el punto de 1px se perdía contra la línea que lo cruza. */
        const r = 1.6 + k * 1.4;
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.acc ? colAcc : colBase;
        ctx.beginPath(); ctx.arc(PX[i], PY[i], r, 0, 6.2832); ctx.fill();
        if (k > 0.02) {
          ctx.globalAlpha = k * 0.9;
          ctx.fillStyle = p.acc ? colAcc : colVivo;
          ctx.beginPath(); ctx.arc(PX[i], PY[i], r, 0, 6.2832); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function arrancar() { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(dibujar); } }
    function frenar() { cancelAnimationFrame(raf); raf = 0; }
    function unaVez() { dibujar(performance.now()); frenar(); }

    const onMove   = e => { const r = host.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
    const onLeave  = () => { mx = my = -1e4; };
    const onResize = () => { armar(); if (quieto.matches) { frenar(); unaVez(); } };
    const onVis    = () => document.hidden ? frenar() : (quieto.matches || arrancar());
    const onQuieto = () => { frenar(); armar(); quieto.matches ? unaVez() : arrancar(); };

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    addEventListener('resize', onResize);

    /* LA CAJA CAMBIA DE TAMAÑO SIN QUE LA VENTANA SE ENTERE, y eso rompía el
       efecto de la peor manera: la columna lateral se colapsa a riel, el marco
       pasa de 1061 a 1465px, el <canvas> se estira por CSS (width:100%) pero
       su BUFFER se queda en 1061. El dibujo sale escalado un 38% en horizontal
       y el enrejado deja de estar donde está el puntero — se ve como que la
       animación no sigue al mouse.

       Va acá adentro y no en quien llama a propósito: el efecto es el único
       que sabe que su buffer depende del tamaño de la caja, así que remedirse
       es su responsabilidad. El lienzo ya tenía que acordarse de llamar a
       refresh() desde settleViewport; con esto deja de hacer falta acordarse.

       En rAF para no remedir varias veces por cuadro mientras la columna
       anima: el observer dispara en cada paso de la transición. */
    let pendiente = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(() => { pendiente = 0; onResize(); });
    }) : null;
    if (ro) ro.observe(host);
    document.addEventListener('visibilitychange', onVis);
    quieto.addEventListener('change', onQuieto);
    const mo = new MutationObserver(() => { armar(); if (quieto.matches) unaVez(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    armar();
    quieto.matches ? unaVez() : arrancar();

    return {
      /* la caja de herramientas empuja el lienzo (punto 6 del brief); el
         canvas fijo necesita rearmarse a las dimensiones nuevas — nunca
         durante la animación, sólo cuando termina (regla 6 de §11). */
      refresh() { armar(); if (quieto.matches) unaVez(); },
      destroy() {
        frenar();
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerleave', onLeave);
        removeEventListener('resize', onResize);
        if (ro) ro.disconnect();
        if (pendiente) cancelAnimationFrame(pendiente);
        document.removeEventListener('visibilitychange', onVis);
        quieto.removeEventListener('change', onQuieto);
        mo.disconnect();
        cv.remove();
      },
    };
  }

  /* --------------------------------------------------------------------
     MONTAR — las tres capas de una, para quien no tenga markup propio.

     El lienzo NO usa esto: sus tres capas están en index.html porque su
     grilla se mueve con el pan y el zoom y necesita que canvas.js le
     sincronice background-size y background-position. Por eso `seguir()` y
     `capas()` se exportan por separado — el lienzo sólo toma el seguidor.
     -------------------------------------------------------------------- */
  function montar(host, op) {
    const puestas = capas(host, ['sw-canvas__glow', 'sw-canvas__orbes']);

    /* EL ENREJADO Y NO LA MÁSCARA. De los dos halos se monta el enrejado: es
       el que hace que los puntos se aparten y se enciendan, que es lo que se
       ve en el estado vacío y lo que se pidió para la hoja. La máscara
       (.sw-canvas__fx) queda para el lienzo nodal, que la necesita porque su
       punteado se mueve con el pan y el zoom.

       Los dos NO van juntos: son dos halos sobre el mismo punteado y se
       superponen (decisión 40, que ya apaga la máscara mientras el vacío está
       puesto). Cada superficie elige uno. */
    const enrejado = campo(host, host, op);

    /* EL ENREJADO VA ARRIBA DE LAS DOS CAPAS QUIETAS. campo() lo inserta al
       principio —le sirve para su uso original, adentro del estado vacío— y
       acá eso lo dejaba DEBAJO del halo y de los orbes, que son opacos: los
       puntos quedaban tapados y el efecto no se veía. Se sube una vez, al
       montar; el orden final es halo, orbes, enrejado, contenido. */
    const cv = host.querySelector('.sw-empty-canvas__field');
    const ultima = puestas[puestas.length - 1];
    if (cv && ultima) ultima.after(cv);

    return {
      destroy() { enrejado.destroy(); puestas.forEach(d => d.remove()); },
    };
  }

  window.SW.ambiente = { montar, capas, seguir, campo };
})();
