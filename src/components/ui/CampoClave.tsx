import React, { useState } from 'react';
import { Icon } from '../Icon.js';

/**
 * Un campo de contraseña con el botón para verla, como el de la pantalla de
 * entrar (`LoginPage`). Al dar de alta a alguien la contraseña la ESCRIBE otra
 * persona y se la tiene que pasar: verla antes de guardar evita el error de
 * tipeo que después nadie puede diagnosticar.
 *
 * UN SOLO RÓTULO, que no cambia al apretarlo: el estado lo dice `aria-pressed`
 * (mismo criterio que el login). El ícono sí cambia, para el que mira.
 */
export function CampoClave({
  value,
  onChange,
  className,
  autoComplete = 'new-password',
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Las clases del input; el botón se monta encima, a la derecha. */
  className: string;
  autoComplete?: string;
  id?: string;
}): React.ReactElement {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={ver ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        aria-pressed={ver}
        aria-label="Mostrar la contraseña"
        title={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        onClick={() => setVer((v) => !v)}
        className="btn absolute top-1/2 right-1 -translate-y-1/2"
        data-variant="ghost"
        data-size="icon-sm"
      >
        <Icon name={ver ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );
}
