import React from 'react';

interface SortIconProps {
  className?: string;
}

/** Left-aligned descending-width bars with a short tick — sort glyph, no PrimeIcons equivalent. */
export function SortIcon({ className = 'h-3.5 w-3.5' }: SortIconProps): React.ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 3.5H12.5V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 8H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 12H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
