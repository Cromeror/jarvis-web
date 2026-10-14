import React from 'react';

/**
 * EL BOTÓN DEL SISTEMA: el `.btn` de Basecoat con el tema (`basecoat-map.css`
 * apunta sus variables a los tokens `--sw-*`). Es el único botón: los de
 * clases sueltas (`bg-indigo-600…`, `BOTON_PRIMARIO`) y el `Button2` del look
 * anterior se fueron, y con ellos el azul que convivía con el violeta.
 *
 * La variante y el tamaño viajan como `data-variant` / `data-size`, que es el
 * idioma de Basecoat. Antes este componente emitía `btn-primary btn-sm`, clases
 * que la versión instalada ya no reconoce: todo `Button` salía primario, pidiera
 * la variante que pidiera.
 *
 * - `primary`: la acción principal (una por pantalla).
 * - `outline`: la secundaria — Cancelar, Copiar.
 * - `ghost`: la que no tiene que competir (también `neutral`, el nombre viejo).
 * - `link`: un filtro o un enlace con forma de botón.
 * - `destructive`: borrar, rechazar.
 *
 * Acepta cualquier atributo de `<button>` (`aria-*`, `title`, `form`…).
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'destructive'
  /** Nombres viejos, por los que ya los usan: `outline` y `ghost`. */
  | 'outlined'
  | 'neutral';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const VARIANTE: Record<ButtonVariant, string | undefined> = {
  primary: undefined,
  secondary: 'secondary',
  outline: 'outline',
  outlined: 'outline',
  ghost: 'ghost',
  neutral: 'ghost',
  link: 'link',
  destructive: 'destructive',
};

const TAMANO: Record<ButtonSize, string | undefined> = {
  xs: 'sm',
  sm: 'sm',
  md: undefined,
  lg: 'lg',
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  /** `sm` por defecto: el tamaño que tenían los botones de las pantallas. */
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  variant = 'primary',
  size = 'sm',
  type = 'button',
  className = '',
  children,
  ...resto
}: ButtonProps): React.ReactElement {
  return (
    <button
      {...resto}
      type={type}
      className={`btn ${className}`.trim()}
      data-variant={VARIANTE[variant]}
      data-size={TAMANO[size]}
    >
      {children}
    </button>
  );
}
