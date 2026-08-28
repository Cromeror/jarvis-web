import React from 'react';

interface RawEditorProps {
  content: string;
  onChange: (value: string) => void;
  /**
   * Solo lectura: el mismo visor, sin poder escribir. Lo usa el explorador de
   * workspaces, que es un apartado de consulta — reusar este componente en vez
   * de escribir un segundo textarea monoespaciado mantiene una sola definicion
   * de "asi se ve un archivo de texto crudo" en toda la app.
   */
  readOnly?: boolean;
}

/**
 * Plain textarea for raw Markdown editing.
 * Design §Editor architecture, REQ-6.
 */
export function RawEditor({ content, onChange, readOnly = false }: RawEditorProps): React.ReactElement {
  return (
    <textarea
      className="raw-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      spellCheck={false}
      placeholder="Contenido Markdown..."
    />
  );
}
