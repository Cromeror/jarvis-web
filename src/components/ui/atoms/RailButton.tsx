import React from 'react';

interface RailButtonProps {
  label: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Botón XS del FocusCard (Figma "Button", instancias "Aprobar"/"Lanzar ahora"
 * — variante Type=Neutral, sin íconos en las dos instancias reales del frame).
 * `Button.tsx` (legado) usa clases `.btn-*` globales que no matchean este
 * estilo — átomo nuevo, mismo criterio que Sidebar2/CardBase de no tocar
 * componentes legacy para portar un frame nuevo de Figma.
 */
export function RailButton({ label, onClick, className = '' }: RailButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-[var(--chatoptionsrail-button-gap)] rounded-[var(--chatoptionsrail-button-radius)] border border-[var(--chatoptionsrail-button-border)] bg-[var(--chatoptionsrail-button-bg)] px-[var(--chatoptionsrail-button-padding-h)] py-[var(--chatoptionsrail-button-padding-v)] text-xs font-bold whitespace-nowrap text-[var(--chatoptionsrail-button-text)] ${className}`}
    >
      {label}
    </button>
  );
}
