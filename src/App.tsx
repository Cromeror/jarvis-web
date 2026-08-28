import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { EditorPage } from './pages/EditorPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProjectMapPage } from './pages/ProjectMapPage.js';
import { ChatPage } from './pages/ChatPage.js';
import { PlansPage } from './pages/PlansPage.js';
import { EnvironmentsPage } from './pages/EnvironmentsPage.js';
import { WorkspacesPage } from './pages/WorkspacesPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { RequireAuth } from './components/layout/RequireAuth.js';
import { PipelineRunView } from './components/Pipeline/PipelineRunView.js';
import { PlanRunView } from './components/Plan/PlanRunView.js';
import { Sidebar2PreviewPage } from './pages/Sidebar2PreviewPage.js';

/**
 * Root app component. Routing uses react-router — real paths, no query
 * params for navigation. Dashboard/Chat share the persistent
 * top nav via AppLayout; ProjectMapPage/EditorPage are full-canvas surfaces
 * that opt out of it:
 *   /                        → AppLayout > DashboardPage
 *   /chat                    → AppLayout > ChatPage (project picker)
 *   /chat/:projectId         → AppLayout > ChatPage
 *   /chat/:projectId/:sessionId → AppLayout > ChatPage (deep-link to one conversation,
 *                              kept in sync on selection so a reload doesn't lose it)
 *   /plans                   → AppLayout > PlansPage (project picker)
 *   /plans/:projectId        → AppLayout > PlansPage
 *   /environments            → AppLayout > EnvironmentsPage (project picker)
 *   /environments/:projectId → AppLayout > EnvironmentsPage
 *   /workspaces              → AppLayout > WorkspacesPage (project picker)
 *   /workspaces/:projectId   → AppLayout > WorkspacesPage (vista raíz del apartado)
 *   /workspaces/:projectId/:workspaceId → idem, con un espacio de trabajo
 *                              elegido. El workspace es un SEGMENTO DE PATH y
 *                              no un query param porque de él cuelgan las demás
 *                              vistas del apartado (explorador, cambios,
 *                              grafo): fija el contexto de todas, y así el link
 *                              es compartible y sobrevive a un reload.
 *   /workspaces/:projectId/:workspaceId/changes?file=<path> → panel de cambios.
 *                              El archivo abierto va como query param y no como
 *                              segmento, igual que en /editor: no es una ruta,
 *                              es qué archivo está abierto — y así un path con
 *                              barras no necesita escaparse dentro de la ruta.
 *   /project/:projectId      → ProjectMapPage
 *   /editor?file=<path>      → EditorPage (file kept as query param — it's
 *                              not a route, just which file is open)
 *   /design-system/sidebar2  → Sidebar2PreviewPage (sandbox del design
 *                              system nuevo portado desde Figma; fuera de
 *                              RequireAuth a propósito — no depende de
 *                              datos reales — y sin link en ningún nav)
 *   /pipeline/:runId         → AppLayout > PipelineRunView (real-time pipeline progress)
 *   /plan-runs/:runId        → AppLayout > PlanRunView (real-time plan progress, parallel by layer)
 */
export default function App(): React.ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:projectId" element={<ChatPage />} />
          <Route path="/chat/:projectId/:sessionId" element={<ChatPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/plans/:projectId" element={<PlansPage />} />
          <Route path="/environments" element={<EnvironmentsPage />} />
          <Route path="/environments/:projectId" element={<EnvironmentsPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:projectId" element={<WorkspacesPage />} />
          <Route path="/workspaces/:projectId/:workspaceId" element={<WorkspacesPage />} />
          <Route path="/workspaces/:projectId/:workspaceId/:view" element={<WorkspacesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/pipeline/:runId" element={<PipelineRunView />} />
          <Route path="/plan-runs/:runId" element={<PlanRunView />} />
        </Route>
        <Route path="/project/:projectId" element={<ProjectMapPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Route>
      <Route path="/design-system/sidebar2" element={<Sidebar2PreviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
