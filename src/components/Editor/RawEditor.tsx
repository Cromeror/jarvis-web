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
 * Textarea monoespaciado para texto crudo. Llena la caja que lo contiene: el
 * alto y el borde los decide quien lo monta, no el visor.
 *
 * Los colores salen de los tokens y no de una clase propia: la `.raw-editor`
 * que lo vestía era del editor de docs viejo y se fue con él, así que el
 * textarea quedaba con el blanco del navegador encima del tema oscuro.
 */
export function RawEditor({ content, onChange, readOnly = false }: RawEditorProps): React.ReactElement {
  return (
    <textarea
      className="block h-full w-full resize-none bg-[var(--sw-surface)] p-[var(--sw-s-4)] font-mono text-xs leading-relaxed text-foreground outline-none placeholder:text-[var(--sw-placeholder)]"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      spellCheck={false}
      placeholder="Contenido Markdown..."
    />
  );
}
