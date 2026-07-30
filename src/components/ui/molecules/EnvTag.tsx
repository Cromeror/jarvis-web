import React from 'react';

interface EnvTagProps {
  label: string;
  active?: boolean;
  className?: string;
}

/**
 * EnvTag — pill de ambiente (Figma "tag-prod"/"tag-staging" dentro de
 * Table/Infraestructura). Distinto del env-row de CardProject (dot+texto
 * sin fondo) — acá sí hay una píldora translúcida (`--envtag-bg`) de por
 * medio, así está en el frame.
 */
export function EnvTag({ label, active = true, className = '' }: EnvTagProps): React.ReactElement {
  return (
    <span className={`inline-flex items-center gap-1 rounded bg-[var(--envtag-bg)] px-2 py-[3px] ${className}`}>
      <span
        className={`size-[5px] shrink-0 rounded-[3px] ${active ? 'bg-[var(--card-env-active)]' : 'bg-[var(--card-env-inactive)]'}`}
      />
      <span className="whitespace-nowrap text-[11px] text-[var(--card-text-secondary)]">{label}</span>
    </span>
  );
}
