import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  children: string;
  /**
   * `prose-invert` (default) para superficies oscuras — el chat; `false`
   * deja `prose` a secas para el panel de planes claro. `max-w-none` siempre:
   * `prose` limita el ancho a 65ch y romperia el ancho de la burbuja/panel.
   */
  invert?: boolean;
  className?: string;
}

/**
 * Bloque de codigo con boton Copiar — unico override sobre el estilo default
 * del plugin de typography (que ya estiliza headings, listas, code inline,
 * etc.). Reemplaza el `pre`/`code` de bloque de `prose` para sumar la accion
 * de copiar.
 */
function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const text = String(children).replace(/\n$/, '');
  // El `code` de un bloque markdown trae `language-<lang>` en su className
  // (p.ej. ```ts -> `language-ts`); lo mostramos como label. Sin resaltado de
  // sintaxis todavia: shiki/rehype-highlight es un follow-up separado.
  const language = /language-(\w[\w-]*)/.exec(className ?? '')?.[1];

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl bg-slate-900">
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-xs text-slate-500">{language ?? ''}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pb-3 text-sm text-slate-100">
        <code>{text}</code>
      </pre>
    </div>
  );
}

/**
 * Markdown compartido por el chat oscuro y el panel de planes claro. Todo el
 * estilo lo pone el plugin `@tailwindcss/typography` via `prose`; no hay
 * overrides `[&_...]` manuales. Unico override de componente: `code`/`pre` de
 * bloque -> `CodeBlock`, para el boton Copiar. `remark-gfm` habilita tablas,
 * tachado, listas de tareas y autolinks.
 */
export function Markdown({ children, invert = true, className }: MarkdownProps): React.ReactElement {
  const classes = ['prose', invert && 'prose-invert', 'max-w-none', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: codeClassName, children: codeChildren, ...props }) {
            const isBlock =
              /language-/.test(codeClassName ?? '') || String(codeChildren).includes('\n');
            if (isBlock) return <CodeBlock className={codeClassName}>{codeChildren}</CodeBlock>;
            return (
              <code className={codeClassName} {...props}>
                {codeChildren}
              </code>
            );
          },
          pre({ children: preChildren }) {
            return <>{preChildren}</>;
          },
          table({ children: tableChildren }) {
            // typography no envuelve la tabla en un contenedor con scroll: una
            // tabla ancha desborda la burbuja/panel y provoca scroll horizontal
            // de TODA la pagina en mobile (confirmado midiendo a 375px). El
            // wrapper confina el desborde a un scroll propio — contencion de
            // overflow, no estilo (misma categoria que el override de code/pre).
            return (
              <div className="overflow-x-auto">
                <table>{tableChildren}</table>
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
