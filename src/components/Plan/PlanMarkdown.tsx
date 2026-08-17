import React from 'react';
import { Markdown } from '../ui/atoms/Markdown.js';

interface PlanMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Markdown de los planes (side panel + modal fullscreen). Wrapper delgado
 * sobre <Markdown> en variante clara (`invert={false}` -> `prose` sin
 * invertir): todo el estilo lo pone el plugin de typography, sin cadena de
 * clases a mano. El `className` de cada call site se reenvia para spacing/tono
 * puntual (mt-*, notas en italica). Gana GFM (tablas, tachado, task-lists) que
 * antes no tenia — el mismo bug de tablas afectaba al panel y al modal.
 */
export function PlanMarkdown({ children, className }: PlanMarkdownProps): React.ReactElement {
  return (
    <Markdown invert={false} className={className}>
      {children}
    </Markdown>
  );
}
