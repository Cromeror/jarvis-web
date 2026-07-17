import React from 'react';

interface FilterIconProps {
  className?: string;
}

/** Three descending-width horizontal bars — funnel/filter glyph, no PrimeIcons equivalent. */
export function FilterIcon({ className = 'h-3.5 w-3.5' }: FilterIconProps): React.ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 4H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 8H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6.5 12H9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
