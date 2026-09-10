# Deuda conocida

Problemas detectados y **no** resueltos, con lo que se midió y por qué se
dejaron. Cada uno dice qué hay que decidir antes de tocarlo — el objetivo es que
quien lo retome no tenga que redescubrir el terreno.

---

## 1. BUG — el panel Historial pollea N proyectos cada 5 segundos

**Dónde:** `src/pages/ChatPage.tsx`, el `useEffect` del `setInterval` (busca
`railOption !== 'history'`).

```ts
const timer = window.setInterval(() => loadSessions(projectIds, { silent: true }), 5000);
```

`loadSessions` hace `Promise.all(projectIds.map((id) => listChatSessions(id)))`:
**una request por proyecto**. Con once proyectos son **once requests cada cinco
segundos — unas 132 por minuto** mientras el panel esté abierto.

### Por qué existe

Está documentado en el código y la razón es real: el SSE es de **una**
conversación —la abierta—, así que para las demás no llega ningún evento que
avise que arrancaron o terminaron. El `busy` de cada fila del historial es un
snapshot del momento del fetch, y sin refresco quedaría congelado.

El polling ya está acotado a cuando el panel se ve (`railOption === 'history'`),
y usa `silent: true` para no escupir un toast por segundo si el server está
caído. O sea: no es descuido, es un parche consciente.

### Por qué se marca como BUG y no como "es lento"

Porque el costo no crece con lo que el usuario mira, sino con **cuántos
proyectos existen en la instalación**. Abrir un panel para ver diez filas puede
disparar once requests, y cada una sobre un proyecto aislado hace que el server
lance un `sudo`. Un proyecto nuevo encarece una pantalla que no tiene nada que
ver con él.

Y el dato que muestra —si una conversación está trabajando— es justamente el
tipo de cosa que debería llegar por evento, no preguntándose en un loop.

### Qué evaluar al retomarlo

- **Endpoint agregado**: `GET /api/chat/sessions?projects=a,b,c` devolviendo
  todo en una respuesta. Mismo refresco, 1 request en vez de N. Es el cambio
  más chico y toca el core.
- **Un SSE de instalación** que emita el `busy` de cualquier conversación. Saca
  el polling en vez de abaratarlo, pero es un canal nuevo que hay que diseñar.
- **Pollear sólo los proyectos con filas visibles**, si el panel pagina.

Lo que NO alcanza: subir el intervalo. Reparte el mismo problema en el tiempo y
empeora el dato que el panel quiere mostrar.

---

## 2. RENDIMIENTO — leer la infraestructura cuesta una request por proyecto

**Dónde:** `src/pages/DashboardPage.tsx` (réplicas + environments) y, hasta
`59a837b`, también `src/pages/ChatPage.tsx`.

El patrón es N+1: para pintar una tabla de proyectos se pide, **por cada uno**,
su lista de réplicas y sus environments.

### Lo que ya se hizo

En `59a837b` se pasó a **carga bajo demanda con cache incremental**:

- El chat pide sólo el proyecto de la conversación abierta y los que aparecen en
  las sesiones ya cargadas — no los once.
- El dashboard dejó de re-pedir en cada cambio de filtro; ahora sólo pide lo que
  falta y mergea.

### Lo que queda

**La carga inicial del dashboard sigue siendo N requests**, porque su tabla de
infraestructura muestra todos los proyectos y necesita el dato de todos. El
cache evita repetirlas, no la primera vez.

Y el costo por request no es despreciable: desde que el listado de réplicas se
resuelve con el `unix_user` del proyecto, cada una sobre un proyecto aislado
lanza un `sudo` del lado del server. Antes era barato porque estaba roto —
devolvía lista vacía sin poder leer nada.

### Qué evaluar al retomarlo

- **Un endpoint agregado de infraestructura**: `GET /api/projects/infra` que
  devuelva réplicas y environments de todos los proyectos de una. Es la misma
  solución que el punto 1 y probablemente convenga diseñarlos juntos.
- **Virtualizar la tabla** y pedir por fila visible, si la lista de proyectos va
  a seguir creciendo.

### Por qué no se hizo ahora

Ambas soluciones son endpoints nuevos en el core, no cambios de front. La carga
bajo demanda era lo que se podía cerrar de este lado sin decidir el contrato.
