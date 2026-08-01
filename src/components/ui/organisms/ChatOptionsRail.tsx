import React from 'react';
import { useCollapsible } from '../../../hooks/useCollapsible.js';
import { RailFocusPanel, type RailFocusPanelProject, type RailFocusPanelAttentionItem, type RailFocusPanelLiveEvent } from './RailFocusPanel.js';
import { RailListPanel, type RailListPanelData } from './RailListPanel.js';
import { RailNavItem } from '../molecules/RailNavItem.js';
import { RailIconButton } from '../molecules/RailIconButton.js';
import { RailHoverPreview } from '../molecules/RailHoverPreview.js';
import type { RailIconName } from '../atoms/RailIcon.js';
import type { RailCountBadgeTone } from '../atoms/RailCountBadge.js';
import type { BadgeStatus } from '../atoms/Badge.js';

/**
 * Contenido del ChatOptionsRail/HoverPreview de un ítem (Figma Focus
 * 7347:1562 / Ejecuciones 7520:36274 — layout literal; Planes/Historial
 * reusan el mismo layout sin diseño propio en Figma todavía). `title`
 * ausente activa la variante vacía de RailHoverPreview en vez de caer al
 * tooltip nativo — por eso `emptyLabel` es la única pieza obligatoria en la
 * práctica: todo ítem puede no tener nada que resumir.
 */
export interface RailHoverPreviewData {
  headerLabel?: string;
  title?: string | null;
  subtitle?: string | null;
  badge?: { label: string; status: BadgeStatus } | null;
  statusText?: string | null;
  emptyLabel?: string;
}

export interface ChatOptionsRailNavItem {
  id: string;
  label: string;
  icon: RailIconName;
  badgeCount?: number;
  badgeTone?: RailCountBadgeTone;
}

/**
 * Ejemplos del diseño, para las previews (Sidebar2PreviewPage) y para no
 * romper un consumidor que no pase datos. ChatPage sí los pasa: desde que el
 * rail está conectado a la DB, `focusProject={null}` + arrays vacíos son
 * estados legítimos (todavía no se reportó foco / no hay eventos) y NO deben
 * caer en estos defaults — por eso el default solo aplica a `undefined`.
 */
const EXAMPLE_FOCUS_PROJECT: RailFocusPanelProject = {
  durationLabel: '45 min activo',
  projectName: 'jarvis-agent',
  description: 'Auth JWT: roles + accesslog Traefik',
  badge: { label: 'Borrador', status: 'info' },
  updatedLabel: 'Actualizado hace 12 min',
  actions: [{ label: 'Aprobar' }, { label: 'Lanzar ahora' }],
};

const EXAMPLE_ATTENTION_ITEMS: RailFocusPanelAttentionItem[] = [
  { id: 'annotations', text: '2 anotaciones sin responder' },
  { id: 'plan-approval', text: "Plan 'Auth JWT' espera aprobación" },
];

const EXAMPLE_LIVE_EVENTS: RailFocusPanelLiveEvent[] = [
  { id: 'e1', status: 'info', text: 'jarvis-agent: migración iniciada', timestamp: 'hace 3s' },
  { id: 'e2', status: 'error', text: 'cash-web: test fallido', timestamp: 'hace 9s' },
  { id: 'e3', status: 'success', text: 'jarvis-agent: docs actualizados', timestamp: 'hace 21s' },
];

const DEFAULT_NAV_ITEMS: ChatOptionsRailNavItem[] = [
  { id: 'plans', label: 'Planes', icon: 'list-checks' },
  { id: 'executions', label: 'Ejecuciones', icon: 'play-circle', badgeCount: 3, badgeTone: 'accent' },
  { id: 'history', label: 'Historial', icon: 'history' },
];

interface ChatOptionsRailProps {
  /** Opción cuyo ContentPanel está abierto dentro del rail (null = el de Focus). */
  activeOption: string | null;
  onToggleOption: (key: string) => void;
  /** Datos de la "Lista compacta" por opción del acordeón, keyed por nav item id (plans/executions/history). Ausente = esa opción no tiene ContentPanel todavía y queda solo como RailNavItem. */
  panels?: Partial<Record<string, RailListPanelData>>;
  /** Tarjeta de hover del rail colapsado por ítem (Figma ChatOptionsRail/HoverPreview) — solo focus/executions la tienen hoy; el resto sigue con el tooltip nativo. */
  hoverPreviews?: Partial<Record<string, RailHoverPreviewData>>;
  /** null = sin foco reportado (estado real, no cae en el ejemplo del diseño). */
  focusProject?: RailFocusPanelProject | null;
  attentionItems?: RailFocusPanelAttentionItem[];
  onAttentionItemClick?: (id: string) => void;
  moreMessagesCount?: number;
  onMoreMessagesClick?: () => void;
  liveEvents?: RailFocusPanelLiveEvent[];
  navItems?: ChatOptionsRailNavItem[];
  focusBadgeCount?: number;
  className?: string;
}

/**
 * ChatOptionsRail — organismo raíz del rail derecho del chat (Figma "DBoard
 * V1.1.X", nodes 7275:1331 expandido / 7277:35890 colapsado). Reemplaza a
 * layout/ChatOptionsRail.tsx (versión vieja, tema claro, un solo ítem) — ver
 * plan en memoria/openspec. A diferencia de Sidebar2 (que recibe `collapsed`
 * como prop controlada porque AppSidebar2 lo combina con el estado de drawer
 * mobile), este organismo posee su propio `useCollapsible('chat-options-rail')`
 * — no hay overlay mobile con el que combinarlo, y el único consumidor
 * (ChatPage) no necesita ese control. Los defaults de contenido son ejemplos
 * del diseño para las previews; ChatPage pasa datos reales (ver useRailFocus),
 * y un array vacío o `focusProject={null}` son estados legítimos que no
 * vuelven al ejemplo.
 */
export function ChatOptionsRail({
  activeOption,
  onToggleOption,
  panels,
  hoverPreviews,
  focusProject = EXAMPLE_FOCUS_PROJECT,
  attentionItems = EXAMPLE_ATTENTION_ITEMS,
  onAttentionItemClick,
  moreMessagesCount,
  onMoreMessagesClick,
  liveEvents = EXAMPLE_LIVE_EVENTS,
  navItems = DEFAULT_NAV_ITEMS,
  focusBadgeCount = attentionItems.length,
  className = '',
}: ChatOptionsRailProps): React.ReactElement {
  const [collapsed, toggleCollapsed] = useCollapsible('chat-options-rail');

  // Focus es un ítem más del acordeón (mismo trato que Planes/Ejecuciones/
  // Historial, sin excepción) — va primero porque así lo pide el diseño, no
  // por ser especial en el código: mismo RailIconButton/RailNavItem que el
  // resto, solo cambia qué ContentPanel dibuja cuando está abierto
  // (RailFocusPanel en vez de RailListPanel, por tener una forma de datos
  // propia — foco/atención/live no encajan en items/badge/acción genéricos).
  const allItems: ChatOptionsRailNavItem[] = [
    { id: 'focus', label: 'Focus', icon: 'target', badgeCount: focusBadgeCount, badgeTone: 'danger' },
    ...navItems,
  ];

  return (
    <aside
      className={`relative hidden h-full shrink-0 flex-col rounded-[var(--chatoptionsrail-radius)] bg-gradient-to-b from-[var(--chatoptionsrail-bg-from)] to-[var(--chatoptionsrail-bg-to)] px-[var(--chatoptionsrail-padding-h)] py-[var(--chatoptionsrail-padding-v)] md:flex ${
        collapsed ? 'w-[72px] gap-[var(--chatoptionsrail-collapsed-gap)]' : 'w-[350px] gap-[var(--chatoptionsrail-gap)]'
      } ${className}`}
    >
      {collapsed ? (
        <>
          {allItems.map((item) => {
            const preview = hoverPreviews?.[item.id];
            return (
              <RailIconButton
                key={item.id}
                icon={item.icon}
                active={activeOption === item.id}
                badge={item.badgeCount ? { count: item.badgeCount, tone: item.badgeTone ?? 'accent' } : undefined}
                // Colapsado no hay dónde dibujar el ContentPanel: elegir una opción
                // expande el rail además de fijarla.
                onClick={() => {
                  onToggleOption(item.id);
                  if (activeOption !== item.id) toggleCollapsed();
                }}
                title={item.label}
                // El hover SIEMPRE es la tarjeta (nunca el tooltip nativo,
                // ni siquiera sin datos): sin `preview` wireado desde afuera
                // se arma un default con label como header y como mensaje
                // vacío, para que los 4 ítems se comporten igual.
                hoverPreview={
                  <RailHoverPreview
                    icon={item.icon}
                    headerLabel={preview?.headerLabel ?? item.label.toUpperCase()}
                    title={preview?.title}
                    subtitle={preview?.subtitle}
                    badge={preview?.badge}
                    statusText={preview?.statusText}
                    emptyLabel={preview?.emptyLabel ?? `Sin ${item.label.toLowerCase()} por ahora.`}
                  />
                }
              />
            );
          })}
        </>
      ) : (
        // Las 4 opciones (Focus incluido) son un acordeón sin excepción:
        // cerrada se ve como RailNavItem, abierta se reemplaza EN SU LUGAR
        // por su ContentPanel, cuyo header ES la opción desplegada (Figma
        // Focus 7418:892 / Planes 7531:1732 / Runs 7531:1677 / Historial).
        // Focus usa RailFocusPanel en vez de RailListPanel porque su
        // contenido (foco/atención/live) no encaja en la forma genérica
        // items/badge/acción de las otras tres.
        <div className="flex min-h-0 w-full flex-1 flex-col gap-[var(--chatoptionsrail-gap)] overflow-y-auto">
          {allItems.map((item) => {
            const isOpen = activeOption === item.id;
            if (item.id === 'focus') {
              return isOpen ? (
                <RailFocusPanel
                  key={item.id}
                  focusProject={focusProject}
                  attentionItems={attentionItems}
                  onAttentionItemClick={onAttentionItemClick}
                  moreMessagesCount={moreMessagesCount}
                  onMoreMessagesClick={onMoreMessagesClick}
                  liveEvents={liveEvents}
                  onToggle={() => onToggleOption(item.id)}
                />
              ) : (
                <RailNavItem key={item.id} icon={item.icon} label={item.label} active={isOpen} onClick={() => onToggleOption(item.id)} />
              );
            }
            const panel = panels?.[item.id];
            return isOpen && panel ? (
              <RailListPanel
                key={item.id}
                label={item.label.toUpperCase()}
                icon={item.icon}
                items={panel.items}
                loading={panel.loading}
                emptyLabel={panel.emptyLabel}
                error={panel.error}
                actionLabel={panel.actionLabel}
                onToggle={() => onToggleOption(item.id)}
                onSelectItem={panel.onSelectItem}
                onAction={panel.onAction}
              />
            ) : (
              <RailNavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={isOpen}
                onClick={() => onToggleOption(item.id)}
              />
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? 'Expandir opciones' : 'Colapsar opciones'}
        className="absolute -left-3 top-6 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 md:flex"
      >
        <i className={`pi ${collapsed ? 'pi-angle-left' : 'pi-angle-right'} text-xs`} />
      </button>
    </aside>
  );
}
