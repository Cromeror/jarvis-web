/// <reference types="vite/client" />

/**
 * Las variables de entorno que el front lee en tiempo de build.
 *
 * Vite sólo expone al cliente las que empiezan con `VITE_`, y se inlinean en el
 * bundle: cambiarlas exige recompilar, no reiniciar. Se declaran acá para que
 * un typo (`VITE_JARVIS_API_URL` en vez de `..._ORIGIN`) sea un error de
 * compilación y no un `undefined` que degrada en silencio al default.
 */
interface ImportMetaEnv {
  /** Origen de la API (`https://api.ejemplo`). Vacío/ausente = mismo origen que el front. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
