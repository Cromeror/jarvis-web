import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav.js';
import { SideNav } from './SideNav.js';

export function AppLayout(): React.ReactElement {
  return (
    <div className="flex h-screen">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
