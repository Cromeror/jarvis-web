import React from 'react';

interface EnvTagProps {
  label: string;
  active?: boolean;
  className?: string;
}

/**
 * EnvTag — píldora de ambiente de la tabla de Infraestructura. Distinta del
 * renglón de ambientes de CardProject (punto + texto sin fondo): acá va sobre
 * una fila de tabla y necesita un fondo propio para leerse como una unidad.
 * El punto es de estado, así que usa el token de éxito y no un verde fijo.
 */
export function EnvTag({ label, active = true, className = '' }: EnvTagProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--sw-r-sm)] bg-muted px-2 py-[3px] ${className}`}
    >
      <span
        className={`size-[5px] shrink-0 rounded-full ${active ? 'bg-[var(--sw-success)]' : 'bg-[var(--sw-faint)]'}`}
      />
      <span className="whitespace-nowrap text-[11px] text-secondary-foreground">{label}</span>
    </span>
  );
}
