import React from 'react';

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = '' }: SpinnerProps): React.ReactElement {
  return (
    <div
      className={`h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
