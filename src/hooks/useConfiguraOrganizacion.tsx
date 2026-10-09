import { useEffect, useState } from 'react';
import { useAuth } from './useAuth.js';
import { listOrganizations } from '../lib/organizations-api.js';

/**
 * Si el usuario tiene algo que configurar en alguna organización: decide si el
 * riel muestra «Mi organización».
 *
 * El operador siempre: configura la de cualquiera. Un cliente, si en alguna de
 * sus organizaciones tiene al menos un permiso — `GET /api/organizations`
 * devuelve sólo las suyas, con lo que puede hacer en cada una. Qué secciones ve
 * adentro lo decide la página, contra los módulos que la organización tiene.
 *
 * Un error al consultar cuenta como «no»: perder una entrada del riel es mejor
 * que mostrar una que lleva a una pantalla vacía.
 */
export function useConfiguraOrganizacion(): boolean {
  const { user } = useAuth();
  const esOperador = user?.account_type === 'operator';
  const [configura, setConfigura] = useState(false);

  useEffect(() => {
    if (!user) {
      setConfigura(false);
      return;
    }
    if (esOperador) {
      setConfigura(true);
      return;
    }
    let vigente = true;
    void listOrganizations()
      .then((orgs) => {
        if (vigente) setConfigura(orgs.some((o) => o.permissions.length > 0));
      })
      .catch(() => {
        if (vigente) setConfigura(false);
      });
    return () => {
      vigente = false;
    };
  }, [user, esOperador]);

  return configura;
}
