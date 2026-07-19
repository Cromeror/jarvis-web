import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav.js';
import { SideNav } from './SideNav.js';

export function AppLayout(): React.ReactElement {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh">
      <SideNav mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onMenuClick={() => setMobileNavOpen(true)} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
