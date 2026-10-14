import React from 'react';
import { Icon } from '../Icon.js';
import { AjustesDeOrganizacion } from './AjustesDeOrganizacion.js';
import { Button } from '../ui/atoms/Button.js';
import { Dialogo } from '../ui/Dialogo.js';

/**
 * EL MODAL DE AJUSTES. Se abre desde «Ajustes» en el menú del avatar y al pie
 * de la navegación (`useAjustes`), y hoy lleva la configuración de la
 * organización: los módulos de organización que tenga —miembros, puertos, la
 * red de contexto con su auditor—.
 *
 * Es un `Dialogo` de pantalla entera: 80% del ancho y alto fijo al 90% de la
 * ventana, para que no salte de tamaño al cambiar de módulo o de pestaña. Las
 * confirmaciones que se abren encima son `Dialogo` también, y su `close` no
 * sube hasta acá: cerrar una no cierra Ajustes. El contenido se monta sólo
 * abierto: así cada apertura carga lo actual y no queda una configuración vieja
 * en memoria.
 */
export function AjustesModal({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}): React.ReactElement | null {
  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      pantalla
      ariaLabel="Ajustes"
      titulo="Ajustes"
      descripcion="La configuración de tu organización."
      pie={
        <Button variant="outline" onClick={onCerrar}>
          <Icon name="x" />
          Cerrar
        </Button>
      }
    >
      {abierto && <AjustesDeOrganizacion />}
    </Dialogo>
  );
}
