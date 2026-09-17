import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/auth-api.js';
import { notifyAuthChanged } from '../hooks/useAuth.js';
import { Icon } from '../components/Icon.js';
import { ThemeSwitch } from '../components/ThemeSwitch.js';
import { useTipeo } from '../hooks/useTipeo.js';
import '../theme/islas/ambience.js';

/**
 * LA PANTALLA DE ENTRAR — el port de `src/login.html` + `auth/login.js` del
 * template (rama `superficie-documento`), sobre NUESTRA autenticación.
 *
 * El markup no es libre: las clases de Basecoat y las `.sw-acceso__*` de
 * `theme/auth/login.css` seleccionan por descendencia, así que la forma del DOM
 * es parte del contrato. Sale de `login.js`, que es la especificación.
 *
 * DOS DIVERGENCIAS deliberadas respecto del template, las dos por la misma
 * razón —acá el login autentica de verdad, allá es una prueba de diseño sin
 * servidor—:
 *
 *  · El campo es USUARIO, no correo: `login()` espera un username. Mantenerlo
 *    como `type="email"` con validación de formato rechazaría usuarios válidos
 *    antes de llegar al servidor. El tratamiento visual es el mismo.
 *  · No está la configuración de la primera vez (`sw-acceso__config`): es el
 *    onboarding de SpaceMyWork, un flujo propio que no tiene contraparte acá.
 *
 * Lo que SÍ está aunque no haga nada, por pedido explícito: el enlace de
 * recuperar contraseña.
 */

const FRASES = [
  'El detalle importa. Tu trabajo hace la diferencia.',
  'Detrás de cada gran proyecto hay un talento haciendo la diferencia.',
  'Conectando talento, acelerando ideas.',
  'Bienvenido a tu nuevo entorno de trabajo inteligente',
];

/* El movimiento arranca sólo si nadie pidió lo contrario. Son dos señales
   distintas: una es preferencia de accesibilidad, la otra es la conexión. */
function prefiereQuieto(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function ahorraDatos(): boolean {
  const c = (navigator as { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const hostRef = useRef<HTMLElement>(null);
  const ambienteRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const usuarioRef = useRef<HTMLInputElement>(null);
  const claveRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [mayus, setMayus] = useState(false);
  const [errUsuario, setErrUsuario] = useState('');
  const [errClave, setErrClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fase, setFase] = useState<'zoom' | undefined>(undefined);

  const [quieto] = useState(prefiereQuieto);
  const [ahorro] = useState(ahorraDatos);
  const [pausadoPorUsuario, setPausadoPorUsuario] = useState(false);
  const [hayVideo, setHayVideo] = useState(!ahorro);

  /* Con movimiento reducido las frases no se tipean: queda la primera entera y
     quieta, que es lo que hace el template. */
  const corriendo = !quieto && !pausadoPorUsuario;
  const { escrito, falta } = useTipeo(FRASES, corriendo);
  const frase = quieto ? FRASES[0] : escrito;
  const resto = quieto ? '' : falta;

  /* EL AMBIENTE DEL LIENZO — halo, orbes y enrejado, el MISMO componente del
     template y no una copia. Se monta como isla sobre el host y se destruye al
     desmontar: es exactamente el caso que `prueba-react/` dejó medido.

     Recibe el bloque entero, no la tarjeta: la malla escucha el puntero sobre
     toda la pantalla, así que no se congela cuando el mouse pasa por encima del
     formulario. */
  useEffect(() => {
    const host = hostRef.current;
    const caja = ambienteRef.current;
    const A = window.SW?.ambiente;
    if (!host || !caja || !A) return;

    /* NO se usa `montar()`: hace `prepend` sobre el host, y como React ya puso
       ahí el video, las capas caían encima y la malla quedaba tapada. Con las
       piezas sueltas el canvas va a un contenedor propio que el JSX ubica
       DESPUÉS del fondo, y el orden deja de depender de cuándo corre el efecto.

       El host sigue siendo quien ESCUCHA el puntero: la malla reacciona sobre
       toda la pantalla, tarjeta incluida, así que no se congela cuando el mouse
       pasa por encima del formulario. */
    const puestas = A.capas(caja, ['sw-canvas__glow', 'sw-canvas__orbes']);
    const enrejado = A.campo(host, caja, { malla: true, paso: '--sw-malla-paso' });

    /* El enrejado va ARRIBA de las dos capas quietas — `campo()` lo inserta al
       principio, que le sirve para su uso original, y ahí queda debajo del halo
       y de los orbes, que son opacos. Es lo mismo que hace `montar()`. */
    const cv = caja.querySelector('.sw-empty-canvas__field');
    const ultima = puestas[puestas.length - 1];
    if (cv && ultima) ultima.after(cv);

    return () => {
      enrejado.destroy();
      puestas.forEach((d) => d.remove());
    };
  }, []);

  /* Con la pestaña oculta se pausa todo: no se gasta batería en lo que nadie
     mira. Al volver, sigue — salvo que lo haya parado el usuario. */
  useEffect(() => {
    const on = (): void => {
      const v = videoRef.current;
      if (document.hidden) void v?.pause();
      else if (!pausadoPorUsuario && !quieto) void v?.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [pausadoPorUsuario, quieto]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (pausadoPorUsuario || quieto) v.pause();
    else void v.play().catch(() => {});
  }, [pausadoPorUsuario, quieto]);

  /* BLOQ MAYÚS es la causa más común de "la contraseña no anda", y la pantalla
     la puede ver antes de que el usuario se equivoque. Sólo lo sabe un evento
     de teclado, así que se mira en cada tecla. */
  function mirarMayus(e: React.KeyboardEvent<HTMLInputElement>): void {
    setMayus(e.getModifierState?.('CapsLock') ?? false);
  }

  /* Los errores dicen QUÉ HACER, no qué salió mal. Se valida al mandar y —una
     vez que hubo error— al corregir: marcar en rojo mientras alguien todavía
     escribe es acusarlo de un error que no terminó de cometer. */
  function validar(): boolean {
    const eu = username.trim() ? '' : 'Escribí tu usuario.';
    const ec = password ? '' : 'Escribí tu contraseña.';
    setErrUsuario(eu);
    setErrClave(ec);
    if (eu) usuarioRef.current?.focus();
    else if (ec) claveRef.current?.focus();
    return !eu && !ec;
  }

  /* ==================================================================
     LA ENTRADA — lo que pasa al apretar «Entrar», en DOS TIEMPOS:

     1 · EXPLOTA (--sw-d-macro): todo hace zoom hacia la cámara, cada capa a su
         profundidad —fondo 1.25, halo 1.6, malla 2.4 y la caja 4— y la caja CON
         lo que tiene adentro. Lo hace el CSS del template a partir de
         `data-fase`; acá sólo se estampa el atributo.
     2 · LLEGA LA APP con el zoom inverso: aparece desde un poco más lejos
         (`shell/llegada.css`).

     Con movimiento reducido no hay explosión: se cambia directo.

     DIVERGE DEL TEMPLATE EN CÓMO VIAJA LA SEÑAL, y no por gusto: allá son dos
     páginas y la segunda mitad se activa leyendo `sessionStorage` en el <head>
     antes de la primera pintura. Acá es una SPA — no hay recarga—, así que el
     atributo se estampa directo. Un sessionStorage que nadie consume al recargar
     dejaría la app animando cada vez que alguien aprieta F5.
     ================================================================== */
  const ms = (n: string): number =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
  const esperar = (t: number): Promise<void> => new Promise((r) => setTimeout(r, t));

  async function explotar(): Promise<void> {
    if (quieto) return;
    setFase('zoom');
    await esperar(ms('--sw-d-macro'));
  }

  function llegar(modo: 'zoom' | 'quieta'): void {
    const raiz = document.documentElement;
    raiz.dataset.llegada = modo;
    /* SE SACA AL TERMINAR, y no es cosmético: el keyframe declara sólo `from`,
       así que al final el body vuelve a no tener transform. Si el atributo
       quedara puesto y algo lo reanimara, un transform vivo en el <body> lo
       convierte en el contenedor de todo lo `position: fixed` de la app.

       El listener va en el body y no en un nodo de React porque esta pantalla
       se desmonta en el medio: la animación la corre el body, que sobrevive. */
    const alTerminar = (ev: AnimationEvent): void => {
      if (ev.target !== document.body) return;
      delete raiz.dataset.llegada;
      document.body.removeEventListener('animationend', alTerminar);
    };
    document.body.addEventListener('animationend', alTerminar);
    /* Red de seguridad: si la animación no llega a correr —pestaña oculta, el
       usuario cambió a movimiento reducido en el medio—, el atributo no se
       queda pegado para siempre. */
    setTimeout(() => {
      delete raiz.dataset.llegada;
      document.body.removeEventListener('animationend', alTerminar);
    }, ms('--sw-d-macro') + 400);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!validar()) return;
    setSubmitting(true);
    try {
      await login(username, password);
      /* La explosión va ANTES de avisar y de navegar: notificar primero podría
         disparar un re-render que se lleve la pantalla a mitad del zoom. */
      await explotar();
      llegar(quieto ? 'quieta' : 'zoom');
      notifyAuthChanged();
      navigate('/', { replace: true });
    } catch (err) {
      setFase(undefined);
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
      setSubmitting(false);
    }
  }

  return (
    <main
      className="sw-acceso"
      ref={hostRef}
      data-fondo={hayVideo ? 'video' : undefined}
      data-fase={fase}
    >
      {/* EL FONDO EN MOVIMIENTO — un video que no se mira: sólo da movimiento
          detrás de la malla, bajo un velo. Si no carga se va entero y vuelven
          los orbes, que es la pantalla de antes. */}
      {hayVideo && (
        <div className="sw-acceso__fondo" aria-hidden="true">
          <video
            ref={videoRef}
            className="sw-acceso__video"
            muted
            loop
            playsInline
            disablePictureInPicture
            preload={ahorro ? 'none' : 'auto'}
            poster="/media/acceso-fondo.jpg"
            onError={() => setHayVideo(false)}
          >
            <source src="/media/acceso-fondo.webm" type="video/webm" />
            <source src="/media/acceso-fondo.mp4" type="video/mp4" />
          </video>
          <div className="sw-acceso__velo" />
        </div>
      )}

      {/* EL AMBIENTE — halo, orbes y enrejado. Va DESPUÉS del fondo y ANTES del
          marco: ése es el orden del template (fondo abajo, ambiente encima,
          contenido arriba), y acá lo fija el JSX porque las capas no llevan
          z-index. */}
      <div className="sw-acceso__ambiente" ref={ambienteRef} aria-hidden="true" />

      {/* EL MARCO envuelve la tarjeta: es el canto ancho de vidrio, y el que
          desenfoca el fondo. */}
      <div className="sw-acceso__marco">
        {/* Arriba de la caja: las frases tipeadas y, pegada a ella, la marca.
            Nada de esto toma foco, así que con teclado se empieza por el campo. */}
        <div className="sw-acceso__encima">
          <p className="sw-acceso__frases" aria-hidden="true">
            <span className="sw-acceso__escrito">{frase}</span>
            <span className="sw-acceso__cursor" />
            <span className="sw-acceso__falta">{resto}</span>
          </p>
          <p className="sw-acceso__marca">
            <Icon name="logo" />
            <span>Jarvis</span>
          </p>
        </div>

        {/* noValidate: los globos nativos del navegador no respetan los tokens
            ni el tema, y en Windows salen en el idioma del sistema. Los mensajes
            van debajo del campo, con aria-invalid y aria-describedby. */}
        <form
          className="card sw-acceso__tarjeta"
          id="acceso-form"
          noValidate
          aria-labelledby="acceso-titulo"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <header>
            <h1 className="sw-acceso__titulo" id="acceso-titulo">
              Entrá a tu espacio
            </h1>
          </header>

          <section className="sw-acceso__campos">
            <div className="field">
              <label className="label" htmlFor="acceso-usuario">
                Usuario
              </label>
              {/* EN UN .input-group AUNQUE NO LLEVE BOTÓN, igual que la
                  contraseña: sobre el vidrio los dos campos se hunden con el
                  mismo relleno y se enfocan igual. El grupo pinta UNA línea, sin
                  el halo que el .input suelto todavía trae. */}
              <div className="input-group">
                <input
                  ref={usuarioRef}
                  id="acceso-usuario"
                  name="usuario"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="nombre.apellido"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errUsuario) setErrUsuario('');
                  }}
                  aria-invalid={errUsuario ? true : undefined}
                  aria-describedby="acceso-usuario-error"
                  autoFocus
                  required
                />
              </div>
              <p className="sw-acceso__error" id="acceso-usuario-error" role="alert">
                {errUsuario}
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="acceso-clave">
                Contraseña
              </label>
              {/* SIN class="input" en el campo: .input-group YA es la caja con
                  borde, y la clase le agregaba un segundo borde adentro. */}
              <div className="input-group">
                <input
                  ref={claveRef}
                  id="acceso-clave"
                  name="clave"
                  type={verClave ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errClave) setErrClave('');
                  }}
                  onKeyUp={mirarMayus}
                  onKeyDown={mirarMayus}
                  aria-invalid={errClave ? true : undefined}
                  aria-describedby="acceso-clave-error acceso-clave-mayus"
                  required
                />
                {/* UN SOLO RÓTULO, que no cambia al apretarlo: el estado lo dice
                    aria-pressed. Un rótulo que cambia Y un aria-pressed dicen dos
                    veces lo mismo, y el lector lo lee al revés. */}
                <button
                  type="button"
                  className="btn"
                  data-variant="ghost"
                  data-size="icon-sm"
                  data-align="inline-end"
                  aria-pressed={verClave}
                  aria-controls="acceso-clave"
                  aria-label="Mostrar la contraseña"
                  onClick={() => setVerClave((v) => !v)}
                >
                  <Icon name="eye" />
                </button>
              </div>
              <p className="sw-acceso__error" id="acceso-clave-error" role="alert">
                {errClave || error}
              </p>
              <p className="sw-acceso__aviso" id="acceso-clave-mayus" role="status">
                {mayus ? 'Bloq Mayús está activado' : ''}
              </p>
            </div>
          </section>

          {/* EN EL ORDEN EN QUE SE VE: el enlace a la izquierda y el botón a la
              derecha, así Tab recorre igual que el ojo. Enter desde cualquier
              campo manda el formulario igual, sin pasar por el enlace. */}
          <footer className="sw-acceso__pie">
            <a className="btn sw-acceso__olvide" data-variant="link" href="#">
              ¿Olvidaste tu contraseña?
            </a>
            <button
              type="submit"
              className="btn sw-acceso__entrar"
              data-size="sm"
              disabled={submitting}
            >
              {submitting ? 'Entrando…' : 'Entrar'}
              <Icon name="avanzar" data-icon="inline-end" />
            </button>
          </footer>
        </form>
      </div>

      {/* Lo que el lector de pantalla anuncia mientras se entra: no ve la
          animación, y sin esto el botón quedaría en silencio. */}
      <p className="sw-acceso__estado" role="status">
        {submitting ? 'Entrando…' : ''}
      </p>

      {/* WCAG 2.2.2: algo que se mueve solo más de cinco segundos necesita cómo
          detenerlo. Pausa el movimiento ENTERO — video y frases juntos. */}
      {!quieto && (
        <button
          type="button"
          className="btn sw-acceso__pausa"
          data-variant="ghost"
          data-size="icon-sm"
          data-pausado={pausadoPorUsuario ? 'true' : undefined}
          aria-label={pausadoPorUsuario ? 'Reanudar el fondo' : 'Pausar el fondo'}
          onClick={() => setPausadoPorUsuario((p) => !p)}
        />
      )}

      {/* El tema, en el rincón de arriba a la derecha. Va después del formulario:
          con teclado se llega a él después de entrar los datos. */}
      <div className="sw-acceso__tema">
        <ThemeSwitch />
      </div>
    </main>
  );
}
