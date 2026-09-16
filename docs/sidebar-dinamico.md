# Sidebar dinámico — CONSTRUIDO (primera vuelta)

> **Estado: CONSTRUIDO.** `AppSidebar2` arma el menú con el piso fijo más los
> paquetes asignados al proyecto de la URL, y `Sidebar2` sabe renderizar el
> submenú. Lo que sigue abierto está al final.

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

**Qué son esas entradas dinámicas: los paquetes asignados al cliente.** Cada
paquete (contabilidad, por ejemplo) es una opción del menú, y adentro un submenú
deja elegir el módulo con el que se va a trabajar (conciliación de bancos,
generación de informes). El modelo —paquete, módulo, utilidad, y quién los
configura— está en `docs/paquetes-y-modulos.md` del repo `jarvis-agent`; acá
sólo vive la navegación.

## Cómo quedó

- **`AppSidebar2`** arma `NAV_ROUTES` (el piso) + una entrada por paquete
  asignado + `ADMIN_ROUTES` (usuarios y catálogo, sólo superadmin).
- **El proyecto sale de la URL** (`projectIdDeLaUrl`): no hay contexto global de
  proyecto en la SPA, y crear uno era un cambio mayor que este menú. Sin
  proyecto en la URL no se muestran paquetes — preferible a mostrar los de un
  proyecto que el usuario no eligió.
- **`Sidebar2NavItemData.children`** es el submenú: se despliega sólo con el
  padre activo (si no, cuatro paquetes serían veinte entradas permanentes) y no
  se muestra colapsado, donde no hay lugar para el texto.
- **Fail-soft**: un 403 o un proyecto sin paquetes dejan el menú en su piso. El
  sidebar no es lugar para mostrar un error de carga.

El modelo de lo que se muestra —paquete, módulo, utilidad y quién los
configura— está en `docs/paquetes-y-modulos.md` del repo `jarvis-agent`.

## Qué sigue abierto

- Si las entradas se derivan además de los permisos que ya existen
  (`packages/storage/src/permissions.ts` en `jarvis-agent`) o siguen siendo un
  eje aparte.
- Qué pasa con una entrada que el menú muestra pero cuya ruta el backend
  deniega. Hoy la asignación es lo único que decide, así que no puede pasar —
  pero en cuanto los permisos entren en la cuenta, sí.
- El piso fijo sigue teniendo Planes, Workspaces y Environments para todos.
  Cuáles de esas son producto y cuáles herramienta interna es una decisión
  pendiente.

## Por qué este documento existe

Nació antes que el código para que la dirección sobreviviera a la conversación
donde se acordó. Ahora lleva su estado arriba y lo pendiente abajo — mismo
criterio que `docs/bounded-contexts.md` de `jarvis-agent`, donde no distinguir
lo diseñado de lo construido ya costó caro.
