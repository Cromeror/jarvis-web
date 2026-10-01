import React from 'react';
import { DropdownMenu } from 'radix-ui';
import { Icon } from '../Icon.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import { useTheme, type Tema } from '../../hooks/useTheme.js';

/**
 * EL MENÚ DE USUARIO del topbar — el avatar y, adentro, el tema, los accesos y
 * cerrar sesión.
 *
 * Es el port del de `shell/chrome.js`, y sigue el patrón que `prueba-react/`
 * dejó validado: Basecoat pone el ASPECTO y Radix el COMPORTAMIENTO —foco,
 * teclado, Escape, ARIA—, porque el JS de Basecoat muta el DOM por detrás de
 * React. Es el primer componente de la demo que necesita comportamiento, así
 * que es el primero que usa Radix.
 *
 * DOS TRAMPAS MEDIDAS, las dos de `prueba-react/`:
 *
 *  · EL WRAPPER `.dropdown-menu` ES OBLIGATORIO. Todo el CSS de Basecoat para
 *    este componente cuelga de él como descendiente.
 *  · EL CONTENT VA SIN `<Portal>`. Portalado al `body` la cadena de descendencia
 *    se corta y no le llega UNA SOLA REGLA — ni la superficie ni el aspecto de
 *    los ítems, que cuelgan de `.dropdown-menu [data-popover] [role=menuitem]`.
 *
 * LA SUPERFICIE ES LA DE BASECOAT (`data-popover`), no una propia. El Content de
 * Radix es hijo DIRECTO del wrapper —`Root` no renderiza nodo—, así que entra por
 * `.dropdown-menu > [data-popover]` y se lleva fondo, borde, sombra y el estilo
 * de los ítems de una. Verificado sobre el CSS compilado: esta versión del
 * paquete no le pone posición a `[data-popover]`, así que no hay nada que pelee
 * con el posicionamiento de Radix.
 *
 * `align="end"` por lo mismo que en el template: el disparador vive pegado al
 * borde derecho, y alineado al inicio el menú se sale de la pantalla.
 *
 * ACÁ TAMBIÉN SE CAMBIA DE PROYECTO, y va primero de todo. Cambiar de proyecto
 * no es navegar: cambia el menú entero —el riel de un cliente SON sus suites—
 * y con él lo que se puede hacer. Eso es un switch de contexto, de la misma
 * familia que quién sos y cómo se ve la app, no una entrada más del sidebar.
 * Tuvo un disparador propio arriba del riel y se movió acá: el riel es lo que
 * el switch CAMBIA, y un control que se reemplaza a sí mismo al usarlo se lee
 * como que algo se rompió.
 */

const TEMAS: { valor: Tema; icono: string; etiqueta: string }[] = [
  { valor: 'auto', icono: 'monitor', etiqueta: 'Seguir al sistema' },
  { valor: 'light', icono: 'sun', etiqueta: 'Claro' },
  { valor: 'dark', icono: 'moon', etiqueta: 'Oscuro' },
];

const ACCIONES: { icono: string; etiqueta: string; atajo?: string }[] = [
  { icono: 'sliders', etiqueta: 'Ajustes' },
  { icono: 'grid', etiqueta: 'Atajos de teclado', atajo: '⌘K' },
  { icono: 'info', etiqueta: 'Ayuda' },
];

export function UserMenu(): React.ReactElement {
  const { user, logout } = useAuth();
  const { projectId, proyectos, elegir } = useActiveProject();
  const tema = useTheme();

  const nombre = user?.username ?? '—';
  const perfil = user?.account_type === 'operator' ? 'Operador del producto' : 'Cliente';
  const iniciales = nombre
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    /* `id="sw-user"` no es opcional: el CSS del template acota el ancho mínimo
       del popover con `#sw-user [data-popover] { min-width: 232px }`. Sin el id
       esa regla no aplica y el menú se encoge al ancho de su texto más largo. */
    <div className="dropdown-menu sw-user" id="sw-user">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="sw-user__trigger" aria-label="Cuenta y preferencias">
            <span className="avatar" data-size="sm" aria-hidden="true">
              <span>{iniciales}</span>
            </span>
          </button>
        </DropdownMenu.Trigger>

        {/* `collisionPadding` es lo que deja aire entre el menú y el borde de la
            ventana: Radix lo descuenta al calcular `--radix-popper-available-height`,
            que es de donde sale el techo de alto del popover (ver `app.css`). Con
            el default —0— el menú llegaría a tocar el borde. */}
        <DropdownMenu.Content align="end" sideOffset={6} collisionPadding={8} data-popover>
          <div className="sw-user__cab" role="presentation">
            <span className="sw-user__nombre">{nombre}</span>
            <span className="sw-user__perfil">{perfil}</span>
          </div>

          {/* EL SWITCH DE PROYECTO. Se dibuja con UNO SOLO también: entonces no
              hay nada que cambiar, pero sigue siendo la única parte de la app
              que dice en qué proyecto se está parado. Sin ninguno —el operador
              recién entrado, o un cliente sin proyectos— no se dibuja: una
              sección vacía no informa nada. */}
          {proyectos.length > 0 && (
            <>
              <DropdownMenu.Separator asChild>
                <hr />
              </DropdownMenu.Separator>

              {/* AGRUPADO COMO EN EL TEMPLATE: `role="group"` con `aria-label`,
                  igual que el grupo de tema en `chrome.js`. El nombre del grupo
                  NO se dibuja — es para el lector de pantalla. Acá había un
                  rótulo visible («Proyecto») con una clase propia metida dentro
                  de `chrome.css`, que es un archivo del template y no se toca. */}
              <DropdownMenu.RadioGroup
                value={projectId ?? ''}
                onValueChange={elegir}
                asChild
              >
                {/* LA ÚNICA PARTE DEL MENÚ QUE SCROLLEA. Con muchos proyectos
                    asignados la lista empujaba todo lo de abajo —tema, accesos,
                    cerrar sesión— fuera de la pantalla, sin forma de llegar.
                    El alto lo acota `app.css`; acá sólo hace falta que el grupo
                    sea un elemento con nombre propio al que agarrarse. */}
                <div role="group" aria-label="Proyecto" className="sw-user__proyectos">
                {proyectos.map((p) => (
                  <DropdownMenu.RadioItem key={p.id} value={p.id} asChild>
                    <button type="button">
                      <Icon name="cubo" />
                      <span>{p.name}</span>
                      <DropdownMenu.ItemIndicator data-indicator>
                        <Icon name="check" />
                      </DropdownMenu.ItemIndicator>
                    </button>
                  </DropdownMenu.RadioItem>
                ))}
                </div>
              </DropdownMenu.RadioGroup>
            </>
          )}

          <DropdownMenu.Separator asChild>
            <hr />
          </DropdownMenu.Separator>

          {/* El indicador de Radix se muestra solo según el valor elegido: no hay
              que sincronizar aria-checked a mano, como sí había que hacer con el
              JS de Basecoat. */}
          <DropdownMenu.RadioGroup value={tema.choice} onValueChange={(v) => tema.set(v as Tema)}>
            {/* asChild + <button>: en el template cada ítem ES un botón, y el CSS
                de Basecoat cuelga de esa anatomía. Radix renderiza un <div> por
                defecto, que no recibe las mismas reglas. El comentario va FUERA
                del map: el cuerpo de la flecha devuelve UNA expresión. */}
            {TEMAS.map((t) => (
              <DropdownMenu.RadioItem key={t.valor} value={t.valor} asChild>
                <button type="button">
                  <Icon name={t.icono} />
                  <span>{t.etiqueta}</span>
                  <DropdownMenu.ItemIndicator data-indicator>
                    <Icon name="check" />
                  </DropdownMenu.ItemIndicator>
                </button>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>

          <DropdownMenu.Separator asChild>
            <hr />
          </DropdownMenu.Separator>

          {ACCIONES.map((a) => (
            <DropdownMenu.Item key={a.etiqueta} asChild>
              <button type="button">
                <Icon name={a.icono} />
                <span>{a.etiqueta}</span>
                {a.atajo && <kbd className="kbd">{a.atajo}</kbd>}
              </button>
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator asChild>
            <hr />
          </DropdownMenu.Separator>

          <DropdownMenu.Item data-variant="destructive" onSelect={() => logout()} asChild>
            <button type="button">
              <Icon name="power" />
              <span>Cerrar sesión</span>
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}
