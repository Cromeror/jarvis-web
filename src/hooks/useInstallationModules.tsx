import { useEffect, useState } from 'react';
import { listInstallationModules, type InstallationModule } from '../lib/installation-api.js';
import { useAuth } from './useAuth.js';

/**
 * Qué módulos de instalación trae ESTA entrega.
 *
 * Decide qué pantallas de administración se ofrecen. Se pregunta al servidor en
 * vez de ser una constante del front porque el bundle es el mismo para todas las
 * entregas: lo que cambia entre un on-premise recortado y el completo es qué se
 * compiló del lado del servidor.
 *
 * Sólo lo pide el operador: la ruta es superadmin y para cualquier otro sería un
 * 403 garantizado en cada montaje. Un error tampoco rompe el riel — se devuelve
 * vacío, que es el mismo efecto que no tener ningún módulo de instalación y deja
 * la pantalla inalcanzable en vez de rota.
 */
export function useInstallationModules(): InstallationModule[] {
  const { user } = useAuth();
  const [modulos, setModulos] = useState<InstallationModule[]>([]);
  const esOperador = user?.account_type === 'operator';

  useEffect(() => {
    if (!esOperador) {
      setModulos([]);
      return;
    }
    let vigente = true;
    void listInstallationModules()
      .then((lista) => {
        if (vigente) setModulos(lista);
      })
      .catch(() => {
        if (vigente) setModulos([]);
      });
    return () => {
      vigente = false;
    };
  }, [esOperador]);

  return modulos;
}
