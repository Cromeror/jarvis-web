import React from 'react';

export type ButtonIconVariant = 'primary' | 'tertiary' | 'neutral' | 'ghost';
export type ButtonIconSize = 'lg' | 'md' | 'sm' | 'xs';

interface ButtonIconProps {
  variant?: ButtonIconVariant;
  size?: ButtonIconSize;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
  className?: string;
}

const SIZE_PADDING: Record<ButtonIconSize, string> = {
  lg: 'p-[14px]',
  md: 'p-[12px]',
  sm: 'p-[8px]',
  xs: 'p-[6px]',
};

// Neutral/Ghost tienen su Focus inset 1px más lejos que Primary/Tertiary en Figma
// (compensa el borde de 1px que Neutral ya dibuja sobre el botón).
const FOCUS_OFFSET_CLASS: Record<ButtonIconVariant, string> = {
  primary: 'focus-visible:outline-offset-2',
  tertiary: 'focus-visible:outline-offset-2',
  neutral: 'focus-visible:outline-offset-[3px]',
  ghost: 'focus-visible:outline-offset-[3px]',
};

const VARIANT_CLASS: Record<ButtonIconVariant, string> = {
  primary: 'bg-[var(--buttonicon-primary-bg)] text-white hover:bg-[var(--buttonicon-primary-bg-hover)]',
  tertiary:
    'bg-gradient-to-r from-[var(--buttonicon-tertiary-from)] via-[var(--buttonicon-tertiary-via)] to-[var(--buttonicon-tertiary-to)] text-white hover:from-[var(--buttonicon-tertiary-from-hover)] hover:via-[var(--buttonicon-tertiary-via-hover)] hover:to-[var(--buttonicon-tertiary-to-hover)]',
  neutral:
    'border border-[var(--buttonicon-neutral-border)] bg-[var(--buttonicon-neutral-bg)] text-[var(--buttonicon-icon-dark)] hover:bg-[var(--buttonicon-neutral-bg-hover)]',
  ghost: 'text-[var(--buttonicon-icon-dark)] hover:bg-[var(--buttonicon-neutral-bg)]',
};

// El glifo (campana) viene fijo del frame de Figma — el componente real no
// tiene slot de ícono — y solo cambia de tamaño en 3 escalones (LG / MD /
// SM=XS). Paths + dimensiones exportados 1:1 vía `download_assets`, no
// redibujados a mano.
const BELL_ICON: Record<'lg' | 'md' | 'sm', { width: number; height: number; viewBox: string; d: string }> = {
  lg: {
    width: 18,
    height: 20,
    viewBox: '0 0 18 20',
    d: 'M17.7572 13.5105C16.9759 12.1283 16.561 10.1442 16.561 7.77691C16.561 5.71434 15.7644 3.73626 14.3465 2.2778C12.9286 0.819351 11.0055 0 9.00023 0C6.99499 0 5.07188 0.819351 3.65396 2.2778C2.23605 3.73626 1.43947 5.71434 1.43947 7.77691C1.43947 10.1452 1.02633 12.1283 0.245047 13.5105C0.0856238 13.7925 0.00111693 14.1126 1.09961e-05 14.4387C-0.00109493 14.7649 0.081239 15.0856 0.238746 15.3687C0.395257 15.6519 0.622422 15.887 0.896791 16.0498C1.17116 16.2125 1.48279 16.297 1.7995 16.2945H5.05603C5.14535 17.307 5.59952 18.2485 6.32933 18.9342C7.05913 19.6198 8.01182 20 9.00023 20C9.98864 20 10.9413 19.6198 11.6711 18.9342C12.4009 18.2485 12.8551 17.307 12.9444 16.2945H16.201C16.5172 16.2965 16.8283 16.2118 17.1021 16.0491C17.376 15.8863 17.6027 15.6515 17.759 15.3687C17.9172 15.086 18.0003 14.7655 18 14.4393C17.9997 14.1132 17.916 13.7929 17.7572 13.5105ZM9.00023 17.7758C8.58523 17.7759 8.18295 17.6285 7.86147 17.3585C7.53999 17.0886 7.31905 16.7127 7.23605 16.2945H10.7644C10.6814 16.7127 10.4605 17.0886 10.139 17.3585C9.81751 17.6285 9.41523 17.7759 9.00023 17.7758ZM2.39896 14.0725C3.19554 12.406 3.59969 10.2896 3.59969 7.77691C3.59969 6.30365 4.16867 4.89073 5.18147 3.84898C6.19427 2.80722 7.56792 2.22197 9.00023 2.22197C10.4325 2.22197 11.8062 2.80722 12.819 3.84898C13.8318 4.89073 14.4008 6.30365 14.4008 7.77691C14.4008 10.2887 14.804 12.406 15.6006 14.0725H2.39896Z',
  },
  md: {
    width: 14,
    height: 16,
    viewBox: '0 0 14 16',
    d: 'M13.8112 10.8084C13.2035 9.70262 12.8808 8.11539 12.8808 6.22153C12.8808 4.57148 12.2612 2.98901 11.1584 1.82224C10.0556 0.655481 8.55981 0 7.00018 0C5.44055 0 3.9448 0.655481 2.84197 1.82224C1.73915 2.98901 1.11959 4.57148 1.11959 6.22153C1.11959 8.11613 0.798253 9.70262 0.190592 10.8084C0.0665963 11.034 0.00086872 11.2901 8.55251e-06 11.551C-0.000851615 11.8119 0.0631859 12.0685 0.185691 12.2949C0.307422 12.5215 0.484106 12.7096 0.697504 12.8398C0.910902 12.97 1.15328 13.0376 1.39961 13.0356H3.93247C4.00194 13.8456 4.35518 14.5988 4.92281 15.1474C5.49044 15.6959 6.23142 16 7.00018 16C7.76894 16 8.50992 15.6959 9.07755 15.1474C9.64518 14.5988 9.99842 13.8456 10.0679 13.0356H12.6007C12.8467 13.0372 13.0887 12.9694 13.3017 12.8392C13.5147 12.7091 13.691 12.5212 13.8126 12.2949C13.9356 12.0688 14.0002 11.8124 14 11.5515C13.9998 11.2906 13.9346 11.0343 13.8112 10.8084ZM7.00018 14.2206C6.6774 14.2207 6.36452 14.1028 6.11448 13.8868C5.86444 13.6709 5.6926 13.3702 5.62804 13.0356H8.37232C8.30776 13.3702 8.13592 13.6709 7.88588 13.8868C7.63584 14.1028 7.32296 14.2207 7.00018 14.2206ZM1.86586 11.258C2.48542 9.92482 2.79976 8.23167 2.79976 6.22153C2.79976 5.04292 3.2423 3.91258 4.03003 3.07918C4.81776 2.24578 5.88616 1.77758 7.00018 1.77758C8.1142 1.77758 9.1826 2.24578 9.97033 3.07918C10.7581 3.91258 11.2006 5.04292 11.2006 6.22153C11.2006 8.23093 11.5142 9.92482 12.1338 11.258H1.86586Z',
  },
  sm: {
    width: 10,
    height: 12,
    viewBox: '0 0 10 12',
    d: 'M9.86512 8.10632C9.43108 7.27696 9.20055 6.08654 9.20055 4.66615C9.20055 3.42861 8.75801 2.24175 7.97028 1.36668C7.18254 0.49161 6.11415 0 5.00013 0C3.88611 0 2.81771 0.49161 2.02998 1.36668C1.24225 2.24175 0.799704 3.42861 0.799704 4.66615C0.799704 6.0871 0.570181 7.27696 0.136137 8.10632C0.0475688 8.27548 0.000620515 8.46754 6.10894e-06 8.66323C-0.000608297 8.85892 0.0451328 9.05135 0.132637 9.22119C0.219587 9.39113 0.34579 9.5322 0.498217 9.62985C0.650644 9.7275 0.823771 9.77819 0.999724 9.77669H2.80891C2.85853 10.3842 3.11084 10.9491 3.51629 11.3605C3.92174 11.7719 4.45101 12 5.00013 12C5.54925 12 6.07852 11.7719 6.48397 11.3605C6.88941 10.9491 7.14173 10.3842 7.19135 9.77669H9.00053C9.17623 9.7779 9.34905 9.72707 9.50119 9.62943C9.65333 9.53179 9.77929 9.39088 9.86612 9.22119C9.954 9.05159 10.0002 8.8593 10 8.66361C9.99982 8.46792 9.95331 8.27572 9.86512 8.10632ZM5.00013 10.6655C4.76957 10.6655 4.54609 10.5771 4.36748 10.4151C4.18888 10.2532 4.06614 10.0276 4.02003 9.77669H5.98023C5.93412 10.0276 5.81137 10.2532 5.63277 10.4151C5.45417 10.5771 5.23068 10.6655 5.00013 10.6655ZM1.33276 8.4435C1.7753 7.44361 1.99983 6.17375 1.99983 4.66615C1.99983 3.78219 2.31593 2.93444 2.87859 2.30939C3.44126 1.68433 4.2044 1.33318 5.00013 1.33318C5.79586 1.33318 6.559 1.68433 7.12166 2.30939C7.68433 2.93444 8.00043 3.78219 8.00043 4.66615C8.00043 6.1732 8.22445 7.44361 8.667 8.4435H1.33276Z',
  },
};

const ICON_SIZE_FOR: Record<ButtonIconSize, 'lg' | 'md' | 'sm'> = { lg: 'lg', md: 'md', sm: 'sm', xs: 'sm' };

/**
 * ButtonIcon — átomo "DBoard V1.1.X" de Figma (node 2673:110900), variantes
 * Type=Primary/Tertiary/Neutral/Ghost × Size=LG/MD/SM/XS. Hover/Focus del
 * frame se resuelven con pseudo-clases (hover:/focus-visible:) en vez de
 * variantes de componente — Disabled es la única que sí necesita ser prop,
 * porque no hay selector CSS equivalente.
 */
export function ButtonIcon({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  label = 'Notifications',
  className = '',
}: ButtonIconProps): React.ReactElement {
  const icon = BELL_ICON[ICON_SIZE_FOR[size]];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-[var(--buttonicon-radius)] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-[var(--buttonicon-focus-border)] disabled:pointer-events-none disabled:opacity-40 ${SIZE_PADDING[size]} ${FOCUS_OFFSET_CLASS[variant]} ${VARIANT_CLASS[variant]} ${className}`}
    >
      <svg className="block shrink-0" width={icon.width} height={icon.height} viewBox={icon.viewBox} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d={icon.d} />
      </svg>
    </button>
  );
}
