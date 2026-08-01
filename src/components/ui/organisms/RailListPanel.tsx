import React from 'react';
import { RailSectionHeader } from '../molecules/RailSectionHeader.js';
import { RailListRow } from '../molecules/RailListRow.js';
import type { RailIconName } from '../atoms/RailIcon.js';
import type { BadgeStatus } from '../atoms/Badge.js';

export interface RailListPanelItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: { label: string; status: BadgeStatus };
  /** true → la fila muestra el botón de acción (en Planes, solo el plan aprobado puede lanzarse). */
  canAct?: boolean;
}

/** Datos de contenido de una opción del acordeón — todo lo que varía entre Planes/Ejecuciones/Historial. */
export interface RailListPanelData {
  items: RailListPanelItem[];
  loading?: boolean;
  emptyLabel?: string;
  error?: string | null;
  actionLabel?: string;
  onSelectItem?: (id: string) => void;
  onAction?: (id: string) => void;
}

interface RailListPanelProps extends RailListPanelData {
  label: string;
  icon: RailIconName;
  /** Click en el header — vuelve a plegar la opción a su RailNavItem. */
  onToggle?: () => void;
  className?: string;
}

/**
 * ChatOptionsRail/Opción/X (Desplegada) — organismo único para las 3 opciones
 * del acordeón (Planes: Figma 7531:1732, Ejecuciones: 7531:1677, Historial):
 * las tres son visualmente idénticas — header que ES la propia opción abierta
 * (`onToggle` la pliega de nuevo a su RailNavItem) + "Lista compacta" (tarjeta
 * blanca, filas separadas por divider de 1px) — solo cambian label/icon/datos/
 * acción de fila. Generalizado desde el RailPlansPanel original (que solo
 * cubría Planes) para que el comportamiento de acordeón sea uniforme en las
 * tres, sin excepción — ver ChatOptionsRail.tsx, que decide label/icon a
 * partir del propio nav item.
 */
export function RailListPanel({
  label,
  icon,
  items,
  loading = false,
  emptyLabel = 'Sin elementos.',
  error = null,
  actionLabel = 'Abrir',
  onToggle,
  onSelectItem,
  onAction,
  className = '',
}: RailListPanelProps): React.ReactElement {
  const placeholder = error ?? (loading ? 'Cargando…' : items.length === 0 ? emptyLabel : null);

  return (
    <div className={`flex w-full shrink-0 flex-col items-start gap-2 ${className}`}>
      <button type="button" onClick={onToggle} aria-expanded className="w-full text-left" title={`Plegar ${label.toLowerCase()}`}>
        <RailSectionHeader label={label} icon={icon} />
      </button>
      {/* El scroll lo maneja el contenedor del rail, no la tarjeta. */}
      <div className="flex w-full flex-col rounded-[var(--chatoptionsrail-list-radius)] bg-[var(--chatoptionsrail-list-bg)] p-[var(--chatoptionsrail-list-padding)]">
        {placeholder !== null ? (
          <p className="py-[var(--chatoptionsrail-listrow-padding-v)] text-[12px] text-[var(--chatoptionsrail-listrow-subtitle-text)]">
            {placeholder}
          </p>
        ) : (
          items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <div className="h-px w-full shrink-0 bg-[var(--chatoptionsrail-list-divider)]" />}
              <RailListRow
                title={item.title}
                subtitle={item.subtitle}
                badge={item.badge}
                onClick={onSelectItem ? () => onSelectItem(item.id) : undefined}
                onPlay={item.canAct && onAction ? () => onAction(item.id) : undefined}
                playLabel={actionLabel}
              />
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}
