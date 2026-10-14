import React from 'react';
import { Markdown } from '../ui/atoms/Markdown.js';

interface PlanMarkdownProps {
  children: string;
  className?: string;
}

/* LOS COLORES DE `prose`, APUNTADOS A LOS TOKENS. El plugin de typography pinta
   con su propia paleta (gris sobre blanco) y la elegía `invert`: `prose` a
   secas para el panel claro, `prose-invert` para el chat oscuro. Con el tema
   del template el fondo depende del tema y no del lugar, así que ninguna de
   las dos sirve fija —en oscuro el texto salía gris oscuro sobre casi negro—.
   El plugin lee sus colores de estas variables, y redefinirlas hace que el
   mismo `prose` siga al tema sin una clase por modo.

   Van desde el contenedor con `[&>.prose]` y no heredadas: `.prose` declara
   las suyas en su propio elemento, así que una heredada pierde siempre. Y van
   escritas una por una porque Tailwind sólo genera las clases que lee
   literales en el código. */
const COLORES_DEL_TEMA = [
  '[&>.prose]:[--tw-prose-body:var(--sw-text-2)]',
  '[&>.prose]:[--tw-prose-headings:var(--sw-text)]',
  '[&>.prose]:[--tw-prose-lead:var(--sw-text-2)]',
  '[&>.prose]:[--tw-prose-links:var(--sw-accent-text)]',
  '[&>.prose]:[--tw-prose-bold:var(--sw-text)]',
  '[&>.prose]:[--tw-prose-counters:var(--sw-muted)]',
  '[&>.prose]:[--tw-prose-bullets:var(--sw-faint)]',
  '[&>.prose]:[--tw-prose-hr:var(--sw-line)]',
  '[&>.prose]:[--tw-prose-quotes:var(--sw-text)]',
  '[&>.prose]:[--tw-prose-quote-borders:var(--sw-line-strong)]',
  '[&>.prose]:[--tw-prose-captions:var(--sw-muted)]',
  '[&>.prose]:[--tw-prose-code:var(--sw-text)]',
  '[&>.prose]:[--tw-prose-th-borders:var(--sw-line-strong)]',
  '[&>.prose]:[--tw-prose-td-borders:var(--sw-line)]',
].join(' ');

/**
 * Markdown de los planes (modal de pantalla completa). Wrapper delgado sobre
 * <Markdown> con `prose` (`invert={false}`) y sus colores tomados del tema.
 * El `className` de cada call site se reenvía para spacing/tono puntual.
 * Gana GFM (tablas, tachado, task-lists).
 */
export function PlanMarkdown({ children, className }: PlanMarkdownProps): React.ReactElement {
  return (
    <div className={COLORES_DEL_TEMA}>
      <Markdown invert={false} className={className}>
        {children}
      </Markdown>
    </div>
  );
}
