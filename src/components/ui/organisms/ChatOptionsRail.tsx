import React from 'react';
import { useCollapsible } from '../../../hooks/useCollapsible.js';
import { RailFocusPanel, type RailFocusPanelProject, type RailFocusPanelAttentionItem, type RailFocusPanelLiveEvent } from './RailFocusPanel.js';
import { RailNavItem } from '../molecules/RailNavItem.js';
import { RailIconButton } from '../molecules/RailIconButton.js';
import type { RailIconName } from '../atoms/RailIcon.js';
import type { RailCountBadgeTone } from '../atoms/RailCountBadge.js';

export interface ChatOptionsRailNavItem {
  id: string;
  label: string;
  icon: RailIconName;
  badgeCount?: number;
  badgeTone?: RailCountBadgeTone;
}

const DEFAULT_FOCUS_PROJECT: RailFocusPanelProject = {
  durationLabel: '45 min activo',
  projectName: 'jarvis-agent',
  description: 'Auth JWT: roles + accesslog Traefik',
  badgeLabel: 'Borrador',
  updatedLabel: 'Actualizado hace 12 min',
  actions: [{ label: 'Aprobar' }, { label: 'Lanzar ahora' }],
};

const DEFAULT_ATTENTION_ITEMS: RailFocusPanelAttentionItem[] = [
  { id: 'annotations', text: '2 anotaciones sin responder' },
  { id: 'plan-approval', text: "Plan 'Auth JWT' espera aprobación" },
];

const DEFAULT_MORE_MESSAGES_COUNT = 3;

const DEFAULT_LIVE_EVENTS: RailFocusPanelLiveEvent[] = [
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
  /** Opción cuyo panel está abierto (o null) — el caller decide abrir/cerrar el panel asociado. */
  activeOption: string | null;
  onToggleOption: (key: string) => void;
  focusProject?: RailFocusPanelProject;
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
 * (ChatPage) no necesita ese control. Props de contenido con defaults de
 * ejemplo (mismo criterio que CardProject/Sidebar2): conectar a datos reales
 * queda fuera de esta pasada.
 */
export function ChatOptionsRail({
  activeOption,
  onToggleOption,
  focusProject = DEFAULT_FOCUS_PROJECT,
  attentionItems = DEFAULT_ATTENTION_ITEMS,
  onAttentionItemClick,
  moreMessagesCount = DEFAULT_MORE_MESSAGES_COUNT,
  onMoreMessagesClick,
  liveEvents = DEFAULT_LIVE_EVENTS,
  navItems = DEFAULT_NAV_ITEMS,
  focusBadgeCount = attentionItems.length,
  className = '',
}: ChatOptionsRailProps): React.ReactElement {
  const [collapsed, toggleCollapsed] = useCollapsible('chat-options-rail');

  return (
    <aside
      className={`relative hidden h-full shrink-0 flex-col rounded-[var(--chatoptionsrail-radius)] bg-gradient-to-b from-[var(--chatoptionsrail-bg-from)] to-[var(--chatoptionsrail-bg-to)] px-[var(--chatoptionsrail-padding-h)] py-[var(--chatoptionsrail-padding-v)] md:flex ${
        collapsed ? 'w-[72px] gap-[var(--chatoptionsrail-collapsed-gap)]' : 'w-[350px] gap-[var(--chatoptionsrail-gap)]'
      } ${className}`}
    >
      {collapsed ? (
        <>
          <RailIconButton
            icon="target"
            active
            badge={focusBadgeCount > 0 ? { count: focusBadgeCount, tone: 'danger' } : undefined}
            onClick={toggleCollapsed}
            title="Ver foco"
          />
          {navItems.map((item) => (
            <RailIconButton
              key={item.id}
              icon={item.icon}
              active={activeOption === item.id}
              badge={item.badgeCount ? { count: item.badgeCount, tone: item.badgeTone ?? 'accent' } : undefined}
              onClick={() => onToggleOption(item.id)}
              title={item.label}
            />
          ))}
        </>
      ) : (
        <>
          <RailFocusPanel
            focusProject={focusProject}
            attentionItems={attentionItems}
            onAttentionItemClick={onAttentionItemClick}
            moreMessagesCount={moreMessagesCount}
            onMoreMessagesClick={onMoreMessagesClick}
            liveEvents={liveEvents}
          />
          {navItems.map((item) => (
            <RailNavItem key={item.id} icon={item.icon} label={item.label} onClick={() => onToggleOption(item.id)} />
          ))}
        </>
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
