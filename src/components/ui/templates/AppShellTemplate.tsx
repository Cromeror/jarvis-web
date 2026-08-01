import React from 'react';
import { Topbar } from '../organisms/Topbar.js';

interface AppShellTemplateProps {
  /** Rail de navegación ya resuelto (AppSidebar2 — vive en layout/, con routing/auth propios) — slot, igual que topbarActions. */
  sidebar: React.ReactNode;
  topbarTitle: string;
  topbarActions?: React.ReactNode;
  onMenuClick?: () => void;
  children: React.ReactNode;
}

/**
 * AppShellTemplate — template del design system "DBoard V1.1.X" (Figma node
 * 7224:858, "Layout / App Shell"). Frame genérico pensado para duplicarse por
 * página ("— content slot — (duplicate this frame per page, replace this
 * area)" es el placeholder real del Content en Figma) — clasificado como
 * template (atomic design): organismos (Sidebar, Topbar) ya existentes,
 * arreglados en un layout de página, sin contenido propio.
 *
 * `sidebar` queda como slot externo (no un import directo de AppSidebar2)
 * porque ese componente vive en components/layout/ — trae routing/auth
 * (useLocation, useAuth) y este template debe quedar puramente
 * presentacional, sin arrastrar esa dependencia hacia ui/templates/.
 *
 * El gap/padding de 8px del frame raíz de Figma y el degradé+radios del
 * Content slot NO estaban implementados antes (AppLayout.tsx los omitía
 * por completo) — quedan acá. Ambos aplican siempre, sin condicionar por
 * ruta: las páginas en tema claro ya se cubren con su propio bg-white
 * opaco, así que el degradé oscuro del Content nunca llega a verse ahí.
 *
 * Radios: una utilidad por esquina, mapeada 1-1 a las Variables de Figma
 * (`Layout/radius-*`, `Topbar/radius-*`). El Content queda al ras del Topbar
 * (esquinas superiores en 0) y redondea solo abajo — pero eso vive en el
 * valor del token, no en la clase. OJO: lo que la página monte adentro del
 * slot tiene su propio radio (p.ej. `ChatContent`, 12px en las 4 esquinas
 * según su componente de Figma) — si el chat se ve redondeado arriba, viene
 * de ahí, no del slot.
 */
export function AppShellTemplate({
  sidebar,
  topbarTitle,
  topbarActions,
  onMenuClick,
  children,
}: AppShellTemplateProps): React.ReactElement {
  return (
    <div className="flex h-dvh gap-[var(--layout-gap)] bg-[var(--app-bg)] p-[var(--layout-padding)]">
      {sidebar}
      <div className="flex h-full min-w-0 flex-1 flex-col items-start overflow-hidden">
        <Topbar title={topbarTitle} onMenuClick={onMenuClick} actions={topbarActions} />
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-tl-[var(--layout-radius-top-left)] rounded-tr-[var(--layout-radius-top-right)] rounded-bl-[var(--layout-radius-bottom-left)] rounded-br-[var(--layout-radius-bottom-right)] bg-gradient-to-b from-[var(--layout-content-bg-from)] to-[var(--layout-content-bg-to)] pt-[var(--layout-content-padding-top)]">
          {children}
        </div>
      </div>
    </div>
  );
}
