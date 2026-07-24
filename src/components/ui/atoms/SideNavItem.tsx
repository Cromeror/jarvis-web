import React from 'react';
import { NavLink } from 'react-router-dom';

interface SideNavItemProps {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

export function SideNavItem({
  to,
  label,
  icon,
  end = false,
  collapsed = false,
  onClick,
}: SideNavItemProps): React.ReactElement {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `sidenav-item ${isActive ? 'sidenav-item-selected' : ''} ${collapsed ? 'md:justify-center md:px-0' : ''}`
      }
    >
      <i className={`pi ${icon} sidenav-item-icon`} />
      <span className={`sidenav-item-label ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
    </NavLink>
  );
}
