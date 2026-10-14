import { useRef } from 'react';
import type React from 'react';

/**
 * CERRAR UN MODAL CON UN CLIC EN EL FONDO, pero sólo si el clic fue en el fondo.
 *
 * Con un `onClick={onClose}` a secas en el overlay, el navegador manda el
 * `click` al ancestro común de donde se APRETÓ y donde se SOLTÓ. Si se aprieta
 * adentro del formulario —seleccionando el texto de la contraseña para
 * corregirla— y se suelta afuera, ese ancestro es el overlay, y el modal se
 * cerraba solo, con lo escrito perdido. Pasaba seguido justo después de un
 * error, que es cuando uno vuelve a seleccionar el campo.
 *
 * Por eso se exige que el clic EMPIECE y TERMINE en el fondo mismo.
 */
export function useCierrePorFondo(onClose: () => void): {
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
} {
  const empezoEnElFondo = useRef(false);
  return {
    onMouseDown: (e) => {
      empezoEnElFondo.current = e.target === e.currentTarget;
    },
    onClick: (e) => {
      if (empezoEnElFondo.current && e.target === e.currentTarget) onClose();
      empezoEnElFondo.current = false;
    },
  };
}
