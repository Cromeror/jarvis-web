import React from 'react';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  selected?: boolean;
  depth?: number;
  onClick: () => void;
  title?: string;
}

export function SidebarItem({
  icon,
  label,
  selected = false,
  depth = 0,
  onClick,
  title,
}: SidebarItemProps): React.ReactElement {
  return (
    <div
      className={`sidebar-item ${selected ? 'sidebar-item-selected' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={onClick}
      title={title}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className="sidebar-item-icon">{icon}</span>
      <span className="sidebar-item-label">{label}</span>
    </div>
  );
}
