import React from 'react';

interface Sidebar2DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * Línea divisoria (Figma node 6996:269 — "Horizontal: 1px alto, adapta
 * ancho al padre. Vertical: 1px ancho, adapta alto al padre").
 */
export function Sidebar2Divider({
  orientation = 'horizontal',
  className = '',
}: Sidebar2DividerProps): React.ReactElement {
  const base = orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full';
  return <div className={`shrink-0 bg-[var(--sidebar2-border)] ${base} ${className}`} />;
}
