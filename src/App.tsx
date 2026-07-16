import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { EditorPage } from './pages/EditorPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProjectMapPage } from './pages/ProjectMapPage.js';
import { ContextGraphPage } from './pages/ContextGraphPage.js';
import { ChatPage } from './pages/ChatPage.js';
import { PlansPage } from './pages/PlansPage.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { PipelineRunView } from './components/Pipeline/PipelineRunView.js';
import { PlanRunView } from './components/Plan/PlanRunView.js';

/**
 * Root app component. Routing uses react-router — real paths, no query
 * params for navigation. Dashboard/ContextGraph/Chat share the persistent
 * top nav via AppLayout; ProjectMapPage/EditorPage are full-canvas surfaces
 * that opt out of it:
 *   /                        → AppLayout > DashboardPage
 *   /context-graph           → AppLayout > ContextGraphPage
 *   /chat                    → AppLayout > ChatPage (project picker)
 *   /chat/:projectId         → AppLayout > ChatPage
 *   /plans                   → AppLayout > PlansPage (project picker)
 *   /plans/:projectId        → AppLayout > PlansPage
 *   /project/:projectId      → ProjectMapPage
 *   /editor?file=<path>      → EditorPage (file kept as query param — it's
 *                              not a route, just which file is open)
 *   /pipeline/:runId         → PipelineRunView (real-time pipeline progress)
 *   /plan-runs/:runId        → PlanRunView (real-time plan progress, parallel by layer)
 */
export default function App(): React.ReactElement {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/context-graph" element={<ContextGraphPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:projectId" element={<ChatPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/plans/:projectId" element={<PlansPage />} />
      </Route>
      <Route path="/project/:projectId" element={<ProjectMapPage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/pipeline/:runId" element={<PipelineRunView />} />
      <Route path="/plan-runs/:runId" element={<PlanRunView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
