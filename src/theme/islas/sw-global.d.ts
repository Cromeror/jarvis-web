/**
 * Las islas del template son scripts de ventana, no módulos ES: se importan por
 * su efecto (`import './islas/ambience.js'`) y publican en `window.SW`.
 *
 * Se declaran acá y no se reescriben en TypeScript a propósito — el README de
 * `prueba-react/` lo dejó medido: `ambience.js` y `toolbox.js` se montan como
 * islas sin tocarlos, así que portarlas sería reintroducir deriva contra el
 * template a cambio de nada.
 */
declare global {
  interface Window {
    SW?: {
      icons?: Record<string, string>;
      icon?: (name: string) => string;
      ambiente?: {
        /* `montar` arma las tres capas de una sobre el host. No nos sirve: hace
           `prepend` sobre un contenedor que React ya llenó, así que las capas
           caen DEBAJO del video y la malla queda tapada (no llevan z-index: es
           puro orden de DOM). Usamos las piezas sueltas, que es para lo que
           están exportadas. */
        montar: (
          host: HTMLElement,
          op?: { malla?: boolean; paso?: string },
        ) => { destroy: () => void; refresh?: () => void };
        /* Crea las capas quietas que falten dentro de `host`. */
        capas: (host: HTMLElement, cuales: string[]) => HTMLElement[];
        /* El enrejado. `host` es quien ESCUCHA el puntero y da la medida;
           `mount` es dónde se cuelga el <canvas>. Que sean dos es lo que nos
           permite escuchar sobre toda la pantalla y dibujar en un contenedor
           propio que React no reordena. */
        campo: (
          host: HTMLElement,
          mount: HTMLElement,
          op?: { malla?: boolean; paso?: string },
        ) => { destroy: () => void; refresh: () => void };
      };
      theme?: {
        get: () => 'auto' | 'light' | 'dark';
        set: (v: 'auto' | 'light' | 'dark') => void;
      };
    };
  }
}

export {};
