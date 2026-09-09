/**
 * Que el deploy de este repo NO toque la API.
 *
 * Es la razón de ser de la separación: mientras la SPA vivía dentro de
 * `http-api`, publicar un cambio de front obligaba a reiniciar `jarvis-api`, y
 * ese restart mata las sesiones de chat en curso de TODOS los proyectos —
 * cambiar un botón interrumpía conversaciones ajenas.
 *
 * Se verifica leyendo el script, no ejecutándolo: correr un deploy en un test
 * es impensable, y lo que hay que fijar es una decisión de contenido —qué
 * comandos NO están— que se observa perfectamente en el fuente.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEPLOY = join(resolve(import.meta.dirname, '..', '..', '..'), 'scripts', 'deploy-prod.sh');

/**
 * Las líneas ejecutables: sin comentarios ni salida a pantalla.
 *
 * Los dos filtros hacen falta y por el mismo motivo. El script MENCIONA a
 * `jarvis-api` dos veces —en un comentario que explica por qué no lo toca, y en
 * un `echo` que le avisa al operador que la API se deploya aparte—, y las dos
 * son lo contrario de tocarlo. Un grep ingenuo las leería como violaciones.
 */
function ejecutables(texto: string): string[] {
  return texto
    .split('\n')
    .map((l) => {
      const i = l.indexOf('#');
      return i === -1 ? l : l.slice(0, i);
    })
    .filter((l) => l.trim() !== '')
    .filter((l) => !/^\s*(echo|printf)\b/.test(l.trim()));
}

describe('despliegue de la web', () => {
  it('Publicar la web no reinicia el proceso de la API', () => {
    // El script MENCIONA jarvis-api en sus comentarios, explicando justamente
    // por qué no lo toca. Por eso se miran sólo las líneas ejecutables: un grep
    // ingenuo leería esa explicación como una violación.
    const activas = ejecutables(readFileSync(DEPLOY, 'utf8'));
    expect(activas.filter((l) => /systemctl\s+(restart|stop)\s+jarvis-api/.test(l))).toEqual([]);
  });

  it('Una conversación en curso sobrevive a un despliegue de la web', () => {
    // Corolario del anterior, y la consecuencia que de verdad importa: el CLI
    // de cada chat se spawnea como hijo de `jarvis-api` y comparte su cgroup,
    // así que sobrevive exactamente mientras ese proceso no se reinicie.
    //
    // Se afirma sobre el script porque es donde está la decisión: ninguna forma
    // de tocar la unit de la API, ni restart ni stop ni reload.
    const activas = ejecutables(readFileSync(DEPLOY, 'utf8'));
    expect(activas.filter((l) => /systemctl\s+\S+\s+jarvis-api/.test(l))).toEqual([]);
  });

  it('La web se revierte sin tocar la API', () => {
    // Revertir el front es volver al bundle anterior en ESTE repo. Lo que se
    // fija es que el script no tenga ninguna forma de cambiar la versión de la
    // API: sin esto, un rollback de front podría arrastrar el backend.
    const activas = ejecutables(readFileSync(DEPLOY, 'utf8'));
    expect(activas.filter((l) => /jarvis-agent.*deploy-prod|pnpm.*http-api/.test(l))).toEqual([]);
  });
});
