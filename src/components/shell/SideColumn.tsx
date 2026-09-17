import React, { useState } from 'react';
import { Icon } from '../Icon.js';

/**
 * LA COLUMNA DERECHA — la caja de herramientas.
 *
 * Hospeda DOS inquilinos que no conviven: la conversación y las herramientas
 * (decisión 43 del template). El conmutador elige cuál ocupa la columna.
 *
 * El `role="tablist"` va en un contenedor INTERNO y no en la fila: un tablist
 * sólo puede contener tabs, y un botón suelto adentro rompe la navegación por
 * flechas del lector de pantalla. La fila es el contenedor visual.
 *
 * Y el nombre viaja en `aria-label` + `data-n`, no en `title`: en modo riel la
 * palabra se esconde con CSS y sin el aria-label la pestaña se queda sin nombre
 * accesible — y `title` traería el globo nativo encima del nuestro.
 */

type Inquilino = 'chat' | 'tools';

const PESTANAS: { id: Inquilino; icono: string; label: string }[] = [
  { id: 'chat', icono: 'mensajes', label: 'Conversación' },
  { id: 'tools', icono: 'wrench', label: 'Herramientas' },
];

export function SideColumn({
  chat,
  herramientas,
}: {
  chat?: React.ReactNode;
  herramientas?: React.ReactNode;
}): React.ReactElement {
  const [activo, setActivo] = useState<Inquilino>('chat');

  return (
    <div className="sw-side-col">
      <div className="sw-side-col__switch">
        <div className="sw-side-col__tabs" role="tablist" aria-label="Qué ocupa la columna">
          {PESTANAS.map((t) => (
            <button
              key={t.id}
              className="sw-side-col__tab"
              type="button"
              role="tab"
              id={`side-col-tab-${t.id}`}
              data-id={t.id}
              data-n={t.label}
              aria-label={t.label}
              aria-selected={activo === t.id}
              tabIndex={activo === t.id ? 0 : -1}
              onClick={() => setActivo(t.id)}
            >
              <Icon name={t.icono} />
              <span className="sw-side-col__label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sw-side-col__body">
        <div className="sw-chat" hidden={activo !== 'chat'}>
          {chat}
        </div>
        <div className="sw-inspector-slot" hidden={activo !== 'tools' || !herramientas}>
          {herramientas}
        </div>
        {/* Un hueco mudo se lee como que algo se rompió: cuando la superficie no
            trae herramientas, la columna lo dice. */}
        <p className="sw-side-col__vacio" hidden={activo !== 'tools' || !!herramientas}>
          Esta superficie no trae caja de herramientas
        </p>
      </div>
    </div>
  );
}
