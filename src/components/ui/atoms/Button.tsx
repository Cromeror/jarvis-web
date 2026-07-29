import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'neutral' | 'outlined';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  /** Defaults to 'sm', which matches this component's original (pre-size-variant) fixed padding/font — existing callers that don't pass `size` render unchanged. */
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'sm',
  disabled = false,
  onClick,
  children,
  title,
  type = 'button',
  className = '',
}: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`btn btn-${variant} btn-${size} ${className}`}
    >
      {children}
    </button>
  );
}
