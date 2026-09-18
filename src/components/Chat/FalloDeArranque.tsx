import React, { useState } from 'react';
import { ExecutorLoginPrompt } from './ExecutorLoginPrompt.js';

/**
 * QUÉ PASÓ CUANDO EL CHAT NO PUDO ARRANCAR, Y QUÉ HACER AL RESPECTO.
 *
 * Existe porque antes había una sola explicación para todos los fallos de
 * arranque: «la sesión del executor está vencida», con su botón de login. Eso
 * es cierto para UNA causa de varias. Un `root_path` apuntando a un directorio
 * borrado daba el mismo cartel, así que la respuesta ofrecida —re-loguear—
 * funcionaba perfecto y no arreglaba nada; el chat seguía sin arrancar y la
 * pantalla seguía diciendo lo mismo. Diagnosticarlo llevó una madrugada.
 *
 * La causa la declara el backend (`PersistentSessionCause`); acá sólo se decide
 * cómo contarla. Lo que cambia entre casos no es el tono sino la ACCIÓN: sólo
 * uno se arregla desde esta pantalla, y ofrecer un botón que no puede resolver
 * el problema es peor que no ofrecer ninguno.
 *
 * El detalle técnico va siempre, incluso cuando hay explicación: es lo que
 * permite reportar el problema sin tener que reproducirlo.
 */

type Explicacion = {
  titulo: string;
  queHacer: string;
};

const EXPLICACIONES: Record<string, Explicacion> = {
  project_root_missing: {
    titulo: 'El directorio del proyecto no existe.',
    queHacer:
      'Jarvis arranca el motor dentro de la carpeta del proyecto, y esa ruta no está en el disco. ' +
      'Corregí el root del proyecto en su configuración, o restaurá el checkout.',
  },
  executor_not_found: {
    titulo: 'No se encontró el ejecutable del motor.',
    queHacer: 'El binario de Claude Code no está en el PATH del servidor. Hay que instalarlo o corregir el PATH.',
  },
  pool_full: {
    titulo: 'Hay demasiadas sesiones activas.',
    queHacer: 'Esperá a que termine alguna y volvé a intentar. No hace falta cambiar nada.',
  },
  executor_session_expired: {
    titulo: 'La sesión del executor está vencida.',
    queHacer: 'Se puede volver a iniciar desde acá.',
  },
};

export function FalloDeArranque({
  causa,
  detalle,
  projectId,
  onResuelto,
}: {
  causa: string;
  /** El mensaje crudo del servidor. Va siempre: es lo que se reporta. */
  detalle: string | null;
  projectId: string | null;
  onResuelto?: () => void;
}): React.ReactElement {
  /* Sólo este caso se arregla desde la pantalla, así que es el único que trae
     el flujo de login entero. */
  if (causa === 'executor_session_expired') {
    return <ExecutorLoginPrompt projectId={projectId} onResuelto={onResuelto} />;
  }

  const explicacion = EXPLICACIONES[causa];
  const [loguear, setLoguear] = useState(false);

  if (loguear) return <ExecutorLoginPrompt projectId={projectId} onResuelto={onResuelto} />;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
      {explicacion ? (
        <>
          <p className="mb-1 font-medium">{explicacion.titulo}</p>
          <p className="mb-2 text-amber-100/80">{explicacion.queHacer}</p>
        </>
      ) : (
        /* Sin causa conocida NO se inventa una explicación: se muestra el error
           tal cual. Una hipótesis presentada como diagnóstico manda a arreglar
           lo que no está roto — que es exactamente lo que pasaba antes. */
        <p className="mb-2 font-medium">Jarvis no pudo arrancar.</p>
      )}
      {detalle && <p className="mb-2 font-mono text-[11px] text-amber-200/70">{detalle}</p>}

      {/* EL LOGIN SIGUE A MANO PARA LO NO CLASIFICADO, pero como OFERTA y no
          como diagnóstico. Hoy ninguna causa se marca todavía como sesión
          vencida —el CLI con credenciales muertas arranca igual y falla más
          tarde, no en el spawn—, así que sin esta salida el flujo de login
          quedaría inalcanzable desde el chat. Dice «probá» y no «es»: la
          diferencia entre ofrecer un camino y afirmar una causa es justamente
          lo que hizo perder tiempo antes. */}
      {!explicacion && (
        <button
          type="button"
          onClick={() => setLoguear(true)}
          className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
        >
          Probar con un login del executor
        </button>
      )}
    </div>
  );
}
