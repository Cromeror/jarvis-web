import React from 'react';
import { Sidebar2Divider } from '../atoms/Sidebar2Divider.js';
import { Sidebar2NavItem } from '../molecules/Sidebar2NavItem.js';
import type { Sidebar2IconName } from '../atoms/Sidebar2Icon.js';

export interface Sidebar2NavItemData {
  id: string;
  label: string;
  icon: Sidebar2IconName;
}

const DEFAULT_ACCENT_ITEM: Sidebar2NavItemData = { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' };
const DEFAULT_ITEMS: Sidebar2NavItemData[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'plans', label: 'Planes', icon: 'plans' },
  { id: 'environments', label: 'Environments', icon: 'environments' },
];
const DEFAULT_SECONDARY_ITEMS: Sidebar2NavItemData[] = [
  { id: 'users', label: 'Usuarios', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

interface Sidebar2Props {
  collapsed?: boolean;
  accentItem?: Sidebar2NavItemData | null;
  items?: Sidebar2NavItemData[];
  secondaryItems?: Sidebar2NavItemData[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

/**
 * Sidebar2 — organismo del design system "DBoard V1.1.X" (Figma node
 * 6940:83). No reemplaza a components/Sidebar/Sidebar.tsx (explorador de
 * archivos del editor) ni a layout/SideNav.tsx (nav global actual): es el
 * nuevo rail que va a ir reemplazando/conviviendo con esos a medida que se
 * porte el resto del design system. `collapsed` sustituye al
 * `sidebarState: 'Collapsed'|'Expanded'` del componente de Figma por un
 * boolean, más idiomático para el resto de la base (mismo patrón que
 * useCollapsible/SideNav).
 */
export function Sidebar2({
  collapsed = false,
  accentItem = DEFAULT_ACCENT_ITEM,
  items = DEFAULT_ITEMS,
  secondaryItems = DEFAULT_SECONDARY_ITEMS,
  activeId = accentItem?.id,
  onSelect,
  className = '',
}: Sidebar2Props): React.ReactElement {
  return (
    <div
      className={`flex h-full flex-col items-center gap-[var(--sidebar2-lg-gap)] rounded-[var(--sidebar2-radius)] bg-[var(--sidebar2-bg-base)] bg-gradient-to-b from-[var(--sidebar2-bg-from)] to-[var(--sidebar2-bg-to)] px-[var(--sidebar2-lg-padding)] py-[var(--sidebar2-lg-padding-v)] ${
        collapsed ? 'w-[72px]' : 'w-[216px]'
      } ${className}`}
    >
      {accentItem && (
        <>
          <Sidebar2NavItem
            icon={accentItem.icon}
            label={accentItem.label}
            tone="accent"
            collapsed={collapsed}
            onClick={() => onSelect?.(accentItem.id)}
          />
          <div className="h-2 w-full shrink-0" />
        </>
      )}

      {items.map((item) => (
        <Sidebar2NavItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          tone={item.id === activeId ? 'active' : 'default'}
          collapsed={collapsed}
          onClick={() => onSelect?.(item.id)}
        />
      ))}

      <div className="min-h-px w-full flex-1" />

      {secondaryItems.length > 0 && (
        <>
          <Sidebar2Divider />
          <div className="h-1 w-full shrink-0" />
          {secondaryItems.map((item) => (
            <Sidebar2NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              tone={item.id === activeId ? 'active' : 'default'}
              collapsed={collapsed}
              onClick={() => onSelect?.(item.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}
