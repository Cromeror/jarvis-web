import React from 'react';

interface EnvironmentEditorProps {
  content: string;
  onChange: (value: string) => void;
}

/**
 * Plain textarea for editing an environment's raw YAML — no syntax
 * highlighting, no Markdown coupling. Dark theme applied via inline style
 * (not the shared `.raw-editor` class, which `RawEditor.tsx` also uses for
 * an unrelated, light-themed editor) so it doesn't leak elsewhere.
 */
export function EnvironmentEditor({ content, onChange }: EnvironmentEditorProps): React.ReactElement {
  return (
    <textarea
      className="raw-editor"
      style={{ background: 'transparent', color: '#e2e8f0' }}
      value={content}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      placeholder={'name: mi-environment\nsteps:\n  - run: docker compose ps'}
    />
  );
}
