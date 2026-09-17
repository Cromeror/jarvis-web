import React from 'react';
import { DropdownMenu } from 'radix-ui';
import { Icon } from '../Icon.js';
import { useAuth } from '../../hooks/useAuth.js';
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
 *    se corta y no le llega UNA SOLA REGLA. Por eso también se le da la
 *    superficie a mano en vez de usar el `[data-popover]` de Basecoat: Radix
 *    posiciona con transform inline y Basecoat con top/inset, y pelean.
 *
 * `align="end"` por lo mismo que en el template: el disparador vive pegado al
 * borde derecho, y alineado al inicio el menú se sale de la pantalla.
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
    <div className="dropdown-menu sw-user">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="sw-user__trigger" aria-label="Cuenta y preferencias">
            <span className="avatar" data-size="sm" aria-hidden="true">
              <span>{iniciales}</span>
            </span>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Content align="end" sideOffset={6} className="sw-user__menu">
          <div className="sw-user__cab" role="presentation">
            <span className="sw-user__nombre">{nombre}</span>
            <span className="sw-user__perfil">{perfil}</span>
          </div>

          <DropdownMenu.Separator />

          {/* El indicador de Radix se muestra solo según el valor elegido: no hay
              que sincronizar aria-checked a mano, como sí había que hacer con el
              JS de Basecoat. */}
          <DropdownMenu.RadioGroup value={tema.choice} onValueChange={(v) => tema.set(v as Tema)}>
            {TEMAS.map((t) => (
              <DropdownMenu.RadioItem key={t.valor} value={t.valor}>
                <Icon name={t.icono} />
                <span>{t.etiqueta}</span>
                <DropdownMenu.ItemIndicator data-indicator>
                  <Icon name="check" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>

          <DropdownMenu.Separator />

          {ACCIONES.map((a) => (
            <DropdownMenu.Item key={a.etiqueta}>
              <Icon name={a.icono} />
              <span>{a.etiqueta}</span>
              {a.atajo && <kbd className="kbd">{a.atajo}</kbd>}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator />

          <DropdownMenu.Item data-variant="destructive" onSelect={() => logout()}>
            <Icon name="power" />
            <span>Cerrar sesión</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}
