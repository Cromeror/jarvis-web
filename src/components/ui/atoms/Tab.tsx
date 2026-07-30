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
 * Tab — átomo "DBoard V1.1.X" de Figma (node 7624:36405), variantes
 * Size=LG/MD/SM/XS × State=Default/Hover/Selected. Hover se resuelve con
 * pseudo-clase CSS (mismo criterio que ButtonIcon) — Selected sí es una prop
 * real porque es un estado de contenido ("cuál proyecto tengo abierto"), no
 * una interacción de mouse.
 */
export function Tab({ label, selected = false, size = 'md', onClick, className = '' }: TabProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative shrink-0 whitespace-nowrap font-bold transition-colors ${SIZE_CLASS[size]} ${
        selected
          ? 'text-[var(--tab-text-selected)]'
          : 'text-[var(--tab-text-default)] hover:text-[var(--tab-text-hover)]'
      } ${className}`}
    >
      {label}
      {selected && (
        <span
          className="absolute inset-x-0 bottom-0 bg-[var(--tab-underline-selected)]"
          style={{ height: 'var(--tab-underline-height)' }}
        />
      )}
    </button>
  );
}
