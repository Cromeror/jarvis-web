# Sidebar dinámico — WIP

> **Estado: WIP.** Es la dirección acordada, no un diseño. Acá se va a ir
> agregando lo que se decida; mientras tanto, nada de esto está implementado —
> el sidebar de hoy es fijo. No citar este documento como si describiera el
> código.

## Qué se quiere

El menú lateral deja de ser una lista fija igual para todos y pasa a armarse
según **quién mira** y **cómo está configurado el proyecto**.

Lo que ya está decidido, y es lo único:

| Quién | Qué ve |
|---|---|
| Administrador | Siempre: el panel administrativo de usuarios y el menú de chats. |
| El resto | Siempre: el menú de chats. **Todo lo demás, dinámico** según la configuración del proyecto. |

O sea: hay un piso fijo por tipo de cuenta —chats para todos, administración para
el admin— y sobre ese piso, el resto de las entradas aparece o no según el
proyecto.

## Qué NO está decidido todavía

Deliberadamente sin resolver, para no cerrar opciones antes de tiempo:

- Dónde vive esa configuración (proyecto, organización, rol), y quién la edita.
- Si las entradas se derivan de los permisos que ya existen
  (`packages/storage/src/permissions.ts` en `jarvis-agent`) o de una declaración
  aparte.
- Qué pasa con una entrada que el menú muestra pero cuya ruta el backend deniega
  —y al revés—, que es donde esto se puede volver confuso.
- La migración desde el sidebar actual.

## Por qué está escrito antes de hacerse

Para que la dirección sobreviva a la conversación donde se acordó. Cada decisión
que se tome entra acá; cuando haya código, este documento cambia de WIP a
CONSTRUIDO y dice qué parte quedó afuera — mismo criterio que
`docs/bounded-contexts.md` de `jarvis-agent`, donde no distinguir lo diseñado de
lo construido ya costó caro.
