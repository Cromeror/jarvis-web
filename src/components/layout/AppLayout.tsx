import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav.js';

export function AppLayout(): React.ReactElement {
  return (
    <div className="flex h-screen flex-col">
      <TopNav />
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
