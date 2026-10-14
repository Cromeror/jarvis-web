import React from 'react';

interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ButtonGroup — junta botones del sistema (`Button`) en una sola pieza.
 *
 * Pega una lista de botones en una sola pieza: sin gap entre ellos, esquinas
 * internas (las de la unión) sin redondear y un separador de 1px — dejando
 * las esquinas externas con el redondeo normal de cada botón. No asume nada
 * de los hijos más allá de que acepten `className`; hoy los hijos son
 * `Button`, pero no hace falta acoplarse a eso.
 */
export function ButtonGroup({ children, className = '' }: ButtonGroupProps): React.ReactElement {
  const items = React.Children.toArray(children);

  return (
    <div className={`flex ${className}`}>
      {items.map((child, i) => {
        if (!React.isValidElement(child)) return child;
        const isFirst = i === 0;
        const isLast = i === items.length - 1;
        const roundingClass = isFirst ? 'rounded-r-none' : isLast ? 'rounded-l-none' : 'rounded-none';
        const dividerClass = isLast ? '' : 'border-r border-primary-foreground/20';
        const existingClassName = (child.props as { className?: string }).className ?? '';

        return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
          className: `${existingClassName} ${roundingClass} ${dividerClass}`.trim(),
        });
      })}
    </div>
  );
}
