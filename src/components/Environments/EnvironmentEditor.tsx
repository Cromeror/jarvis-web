import React from 'react';

interface EnvironmentEditorProps {
  content: string;
  onChange: (value: string) => void;
}

/**
 * Plain textarea for editing an environment's raw YAML — no syntax
 * highlighting, no Markdown coupling. Toma los colores del tema (texto
 * primario sobre la superficie de abajo) en vez de un oscuro fijo: un editor
 * negro adentro de la app clara era una isla de otro producto.
 */
export function EnvironmentEditor({ content, onChange }: EnvironmentEditorProps): React.ReactElement {
  return (
    <textarea
      className="block h-full w-full resize-none bg-transparent px-6 py-3 font-mono text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      placeholder={'name: mi-environment\nsteps:\n  - run: docker compose ps'}
    />
  );
}
