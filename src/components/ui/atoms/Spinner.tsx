import React from 'react';

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = '' }: SpinnerProps): React.ReactElement {
  return (
    <div
      className={`h-4 w-4 animate-spin rounded-full border-2 border-[var(--sw-line-strong)] border-t-primary ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
