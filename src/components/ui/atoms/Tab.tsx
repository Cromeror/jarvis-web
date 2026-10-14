import React from 'react';

export type TabSize = 'lg' | 'md' | 'sm' | 'xs';

interface TabProps {
  label: string;
  selected?: boolean;
  size?: TabSize;
  onClick?: () => void;
  className?: string;
}

const SIZE_CLASS: Record<TabSize, string> = {
  lg: 'px-6 py-3.5 text-base',
  md: 'px-5 py-2.5 text-base',
  sm: 'px-3 py-1.5 text-sm',
  xs: 'px-2 py-1.5 text-xs',
};

/**
 * Tab — pestaña con subrayado. Hover se resuelve con pseudo-clase CSS;
 * Selected sí es una prop real porque es un estado de contenido ("cuál
 * proyecto tengo abierto"), no una interacción de mouse. El subrayado es el
 * acento del tema, lo mismo que marca lo elegido en el resto del sistema.
 */
export function Tab({ label, selected = false, size = 'md', onClick, className = '' }: TabProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative shrink-0 whitespace-nowrap font-bold transition-colors ${SIZE_CLASS[size]} ${
        selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      } ${className}`}
    >
      {label}
      {selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
    </button>
  );
}
