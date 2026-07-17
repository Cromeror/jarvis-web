import React from 'react';

export type IconTileShape = 'square' | 'circle';

interface IconTileProps {
  icon: string;
  className?: string;
  shape?: IconTileShape;
  size?: number;
}

const SHAPE_CLASS: Record<IconTileShape, string> = {
  square: 'rounded-lg',
  circle: 'rounded-full',
};

/** Icon tile — square or circular container for a PrimeReact icon glyph, size in px. */
export function IconTile({
  icon,
  className = 'bg-slate-100 text-slate-500',
  shape = 'square',
  size = 36,
}: IconTileProps): React.ReactElement {
  return (
    <span
      style={{ height: size, width: size }}
      className={`flex shrink-0 items-center justify-center text-base ${SHAPE_CLASS[shape]} ${className}`}
    >
      <i className={`pi ${icon}`} />
    </span>
  );
}
