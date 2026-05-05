import React from 'react';

export function ExplorerPage(): React.ReactElement {
  return (
    <div className="explorer-page">
      <div className="explorer-placeholder">
        <h2>Jarvis Flow UI</h2>
        <p>Seleccioná un archivo del sidebar para editarlo.</p>
        <p className="explorer-hint">
          O usá el botón <strong>+</strong> para crear un nuevo documento.
        </p>
      </div>
    </div>
  );
}
