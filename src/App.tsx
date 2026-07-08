import React, { useState } from 'react';
import { EditorPage } from './pages/EditorPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProjectMapPage } from './pages/ProjectMapPage.js';
import { ContextGraphPage } from './pages/ContextGraphPage.js';

type View = 'dashboard' | 'project' | 'editor' | 'context-graph';

interface AppState {
  view: View;
  projectId?: string;
  file?: string;
}

/**
 * Root app component.
 * Routing is query-string based:
 *   ?view=dashboard          → DashboardPage (default)
 *   ?view=project&id=<id>   → ProjectMapPage
 *   ?file=<path>             → EditorPage (legacy route preserved)
 * No react-router — uses useState + URLSearchParams + History API.
 * ADR-3, REQ-9.
 */
export default function App(): React.ReactElement {
  const getStateFromUrl = (): AppState => {
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    if (file) return { view: 'editor', file };
    const view = params.get('view') as View | null;
    if (view === 'project') {
      const id = params.get('id') ?? undefined;
      return { view: 'project', projectId: id };
    }
    if (view === 'context-graph') return { view: 'context-graph' };
    // default: dashboard
    return { view: 'dashboard' };
  };

  const [appState, setAppState] = useState<AppState>(getStateFromUrl);

  // Listen for browser navigation (back/forward)
  React.useEffect(() => {
    const handlePopState = (): void => {
      setAppState(getStateFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (state: AppState): void => {
    const url = new URL(window.location.href);
    // Clear existing params
    url.search = '';
    if (state.view === 'editor' && state.file) {
      url.searchParams.set('file', state.file);
    } else if (state.view === 'project' && state.projectId) {
      url.searchParams.set('view', 'project');
      url.searchParams.set('id', state.projectId);
    } else if (state.view === 'context-graph') {
      url.searchParams.set('view', 'context-graph');
    } else {
      url.searchParams.set('view', 'dashboard');
    }
    window.history.pushState({}, '', url.toString());
    setAppState(state);
  };

  const handleNavigateToProject = (projectId: string): void => {
    navigate({ view: 'project', projectId });
  };

  const handleBackToDashboard = (): void => {
    navigate({ view: 'dashboard' });
  };

  const handleNavigateToContextGraph = (): void => {
    navigate({ view: 'context-graph' });
  };

  const handleFileChange = (path: string | null): void => {
    if (path) {
      navigate({ view: 'editor', file: path });
    } else {
      navigate({ view: 'dashboard' });
    }
  };

  if (appState.view === 'editor') {
    return (
      <EditorPage
        initialFile={appState.file ?? null}
        onFileChange={handleFileChange}
      />
    );
  }

  if (appState.view === 'project') {
    if (!appState.projectId) {
      // ?view=project without &id= → redirect to dashboard
      return (
        <DashboardPage onNavigateToProject={handleNavigateToProject} />
      );
    }
    return (
      <ProjectMapPage
        projectId={appState.projectId}
        onBack={handleBackToDashboard}
      />
    );
  }

  if (appState.view === 'context-graph') {
    return (
      <ContextGraphPage
        onEditFile={(path) => navigate({ view: 'editor', file: path })}
        onBack={handleBackToDashboard}
      />
    );
  }

  // default: dashboard
  return (
    <DashboardPage
      onNavigateToProject={handleNavigateToProject}
      onNavigateToContextGraph={handleNavigateToContextGraph}
    />
  );
}
