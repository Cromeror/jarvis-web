import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon.js';
import { pedirAccesoAlPreview, validarRd } from '../lib/preview-auth-api.js';

/**
 * LA PUERTA DE LOS PREVIEWS — `/preview-login?rd=<URL del preview>`.
 *
 * Acá llega el navegador cuando Traefik le corta el paso a un preview
 * (`https://<proyecto>-dev.…`) por no tener la cookie de ese host. La pantalla
 * no decide nada: pide el acceso con la sesión de Jarvis y, si el server lo da,
 * se va al callback del preview, que canjea el ticket por la cookie.
 *
 * Va DETRÁS de `RequireAuth` pero FUERA de `AppLayout`: sin sesión, el gate
 * manda al login con esta URL como vuelta (`ruta-de-vuelta.ts`), y con sesión
 * no tiene sentido pintar el riel y la barra para algo que dura un parpadeo.
 * Reusa la tarjeta del login (`sw-acceso`) por eso: es la misma clase de
 * pantalla —una puerta, no un lugar—, sin el fondo animado.
 */
export function PreviewLoginPage(): React.ReactElement {
  const [params] = useSearchParams();
  const rd = params.get('rd');
  const validacion = validarRd(rd);
  const [error, setError] = useState<string | null>(validacion.ok ? null : validacion.error);
  /* En StrictMode el efecto corre dos veces en dev; dos `grant` son dos tickets
     y dos filas de auditoría por una sola apertura. El ref lo deja en una. */
  const pedido = useRef(false);

  useEffect(() => {
    if (!validacion.ok || pedido.current) return;
    pedido.current = true;
    pedirAccesoAlPreview(validacion.rd)
      // Otro origen: el router no tiene nada que hacer acá.
      .then((redirect) => window.location.assign(redirect))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudo abrir el entorno.');
      });
    // `rd` es la única entrada real; `validacion` se deriva de él en cada render.
  }, [rd]);

  return (
    <main className="sw-acceso">
      <div className="sw-acceso__marco">
        <div className="sw-acceso__encima">
          <p className="sw-acceso__marca">
            <Icon name="logo" />
            <span>Jarvis</span>
          </p>
        </div>

        <section className="card sw-acceso__tarjeta" aria-labelledby="preview-titulo">
          <header>
            <h1 className="sw-acceso__titulo" id="preview-titulo">
              {error ? 'No se pudo abrir el entorno' : 'Abriendo el entorno…'}
            </h1>
          </header>

          {/* role=alert para el error y status para la espera: el lector de
              pantalla no ve que la página cambió de estado si no se le avisa. */}
          {error ? (
            <p className="sw-acceso__error" role="alert">
              {error}
            </p>
          ) : (
            <p className="sw-acceso__aviso" role="status">
              Verificando tu acceso.
            </p>
          )}

          {error && (
            <footer className="sw-acceso__pie">
              <span />
              <Link to="/" className="btn" data-size="sm" replace>
                Volver a Jarvis
                <Icon name="avanzar" data-icon="inline-end" />
              </Link>
            </footer>
          )}
        </section>
      </div>
    </main>
  );
}
