import React, { useEffect, useRef } from 'react';

/**
 * EL MODAL DEL SISTEMA: el `<dialog class="dialog">` de Basecoat, con el tema
 * (`basecoat-ext.css`: la sombra de modal, la animación) y lo que cada uno
 * escribía a mano.
 *
 * Reemplaza al overlay propio (`fixed inset-0` + tarjeta blanca), que no seguía
 * el tema —quedaba blanco en oscuro— y vivía en la capa de `z-index`, debajo de
 * cualquier otro `<dialog>` abierto. Éste va a la capa superior del navegador.
 *
 * Tres comportamientos que no se reescriben en cada uso:
 *
 * - **Escape cierra**, porque lo hace el `<dialog>` nativo, y avisa por `onCerrar`.
 * - **Un clic en el fondo cierra sólo si EMPIEZA y TERMINA en el fondo.** El
 *   navegador manda el `click` al ancestro común de donde se apretó y donde se
 *   soltó: apretar adentro —seleccionando la contraseña para corregirla— y
 *   soltar afuera cerraba el modal con lo escrito perdido.
 * - **El `close` no sube por el árbol de React**: un diálogo abierto encima de
 *   otro (uno de Ajustes) cerraba también el de abajo.
 *
 * Con `onSubmit` el contenido va en un `<form>`: Enter guarda, y los botones
 * del `pie` pueden ser `type="submit"`.
 */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  pie,
  onSubmit,
  ancho = 560,
  autoComplete,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
  /** Los botones de abajo. */
  pie?: React.ReactNode;
  onSubmit?: () => void;
  /** Ancho máximo en px. */
  ancho?: number;
  /** Para el `<form>`: `off` cuando las credenciales son de otra persona. */
  autoComplete?: string;
}): React.ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const empezoEnElFondo = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  const contenido = (
    <>
      <header>
        <h2>{titulo}</h2>
        {descripcion ? <p>{descripcion}</p> : null}
      </header>
      {/* El cuerpo es lo que crece: usa el alto disponible hasta que la caja
          llega al 90% de la pantalla, y recién ahí aparece su scroll. El
          encabezado y el pie quedan fijos. `min-h-0` es lo que deja a un hijo
          flex achicarse por debajo de su contenido. */}
      <section className="min-h-0 overflow-y-auto">{children}</section>
      {pie ? <footer>{pie}</footer> : null}
    </>
  );

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={(e) => {
        e.stopPropagation();
        onCerrar();
      }}
      onMouseDown={(e) => {
        empezoEnElFondo.current = e.target === ref.current;
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (empezoEnElFondo.current && e.target === ref.current) ref.current?.close();
        empezoEnElFondo.current = false;
      }}
    >
      {/* La caja es el hijo directo del <dialog> (Basecoat estila `.dialog > *`):
          un <form> cuando guarda, un <article> cuando no. */}
      {onSubmit ? (
        <form
          autoComplete={autoComplete}
          style={{ width: '100%', maxWidth: `min(${ancho}px, calc(100vw - 2rem))`, maxHeight: '90vh' }}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {contenido}
        </form>
      ) : (
        <article style={{ width: '100%', maxWidth: `min(${ancho}px, calc(100vw - 2rem))`, maxHeight: '90vh' }}>{contenido}</article>
      )}
    </dialog>
  );
}
