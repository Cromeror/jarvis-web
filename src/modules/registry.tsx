import React, { lazy } from 'react';
import type { CatalogModule } from '../lib/catalog-api.js';

/**
 * Lo que un módulo construido recibe para dibujar su área de trabajo.
 *
 * Le llega el módulo ENTERO —con sus utilidades ya resueltas— y el proyecto,
 * que es lo que necesita para ejecutar: una utilidad se corre contra el
 * proyecto que la tiene asignada, no en abstracto.
 */
export interface ModuleViewProps {
  projectId: string;
  module: CatalogModule;
}

/**
 * El registro de VISTAS, indexado por la `key` del módulo en el código.
 *
 * Es la mitad del front del registro de módulos: el backend dice qué módulos
 * existen y cuáles tiene este proyecto; esto dice qué se dibuja al entrar.
 *
 * `lazy` y no import directo: los módulos van a ser muchos y cada cliente usa
 * unos pocos. Con imports directos, todos entrarían en el bundle inicial y cada
 * cliente pagaría la descarga del producto entero para ver su menú.
 */
export const MODULE_VIEWS: Record<string, React.LazyExoticComponent<React.ComponentType<ModuleViewProps>>> = {
  'demo-conciliacion': lazy(async () => ({ default: (await import('./demo-conciliacion/View.js')).View })),
};

/**
 * La vista de un módulo, o `null` si esta versión del front no la tiene.
 *
 * `null` es un estado NORMAL, no un error: el front y la API se despliegan por
 * separado, así que un módulo nuevo existe en la base —y en el menú— antes de
 * que el bundle lo tenga. Quien llame tiene que mostrar eso explícitamente, no
 * una pantalla en blanco.
 */
export function moduleView(
  key: string | null,
): React.LazyExoticComponent<React.ComponentType<ModuleViewProps>> | null {
  if (!key) return null;
  return MODULE_VIEWS[key] ?? null;
}
