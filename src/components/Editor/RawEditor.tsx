import React from 'react';

interface RawEditorProps {
  content: string;
  onChange: (value: string) => void;
}

/**
 * Plain textarea for raw Markdown editing.
 * Design §Editor architecture, REQ-6.
 */
export function RawEditor({ content, onChange }: RawEditorProps): React.ReactElement {
  return (
    <textarea
      className="raw-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      placeholder="Contenido Markdown..."
    />
  );
}
