import React from 'react';

export type EditorMode = 'guided' | 'raw';

interface ModeToggleProps {
  mode: EditorMode;
  guided: boolean; // whether guided mode is available
  dirty: boolean;
  onChange: (mode: EditorMode) => void;
}

/**
 * Tabs for switching between Guiado and Raw editor modes.
 * Design §Editor architecture, REQ-6.
 */
export function ModeToggle({ mode, guided, dirty, onChange }: ModeToggleProps): React.ReactElement {
  return (
    <div className="mode-toggle">
      <button
        className={`mode-tab ${mode === 'guided' ? 'mode-tab-active' : ''}`}
        disabled={!guided}
        title={guided ? 'Modo guiado por secciones' : 'Estructura no compatible'}
        onClick={() => guided && onChange('guided')}
      >
        Guiado
      </button>
      <button
        className={`mode-tab ${mode === 'raw' ? 'mode-tab-active' : ''}`}
        onClick={() => onChange('raw')}
      >
        Raw{dirty && mode === 'raw' && <span className="dirty-dot" title="Cambios sin guardar" />}
      </button>
      {dirty && mode !== 'raw' && <span className="dirty-dot" title="Cambios sin guardar" />}
    </div>
  );
}
