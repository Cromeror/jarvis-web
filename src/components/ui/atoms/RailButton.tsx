import React from 'react';
import { Button } from './Button.js';

interface RailButtonProps {
  label: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Botón chico del FocusCard y de las filas de ATENCIÓN ("Aprobar", "Lanzar
 * ahora"). Es el `Button` del sistema en `outline`: antes era un átomo propio
 * pintado con variables `--chatoptionsrail-*` que nunca se definieron, así que
 * salía sin borde ni fondo. Se conserva el nombre para no tocar a los dos
 * llamadores, pero el aspecto lo decide el sistema y no este archivo.
 */
export function RailButton({ label, onClick, className = '' }: RailButtonProps): React.ReactElement {
  return (
    <Button variant="outline" size="xs" onClick={onClick} className={`whitespace-nowrap ${className}`}>
      {label}
    </Button>
  );
}
