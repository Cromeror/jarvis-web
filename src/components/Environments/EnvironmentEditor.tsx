import React from 'react';

interface EnvironmentEditorProps {
  content: string;
  onChange: (value: string) => void;
}

/** Plain textarea for editing an environment's raw YAML — no syntax highlighting, no Markdown coupling. */
export function EnvironmentEditor({ content, onChange }: EnvironmentEditorProps): React.ReactElement {
  return (
    <textarea
      className="raw-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      placeholder={'name: mi-environment\nsteps:\n  - run: docker compose ps'}
    />
  );
}
