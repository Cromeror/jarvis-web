import React, { useEffect, useState } from 'react';
import { getFile } from '../../lib/api.js';
import type { GraphNode } from '../../lib/context-graph.js';

interface Props {
  node: GraphNode | null;
  onClose: () => void;
  onEdit: (path: string) => void;
}

/** Minimal markdown → HTML renderer (headings, bold, links, code, lists) */
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold / italic
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="#" data-path="$2">$1</a>')
    // list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // code blocks
    .replace(/```[\s\S]*?```/g, (m) => `<pre><code>${m.slice(3, -3).replace(/^[^\n]+\n/, '')}</code></pre>`)
    // paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hloprc])(.+)$/gm, '<p>$1</p>')
    // wrap li
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
}

export function DocPreviewPanel({ node, onClose, onEdit }: Props): React.ReactElement | null {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!node?.path) {
      setContent(null);
      return;
    }
    setLoading(true);
    setError(null);
    setContent(null);

    getFile(node.path)
      .then((f) => setContent(f.content))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error loading file');
      })
      .finally(() => setLoading(false));
  }, [node?.path]);

  if (!node) return null;

  const hasFile = Boolean(node.path);

  return (
    <div className="doc-preview-panel">
      <div className="doc-preview-header">
        <div className="doc-preview-title-row">
          <span className="doc-preview-type">{node.type}</span>
          <span className="doc-preview-name">{node.label}</span>
        </div>
        <div className="doc-preview-actions">
          {hasFile && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => node.path && onEdit(node.path)}
            >
              Editar
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {node.description && (
        <p className="doc-preview-desc">{node.description}</p>
      )}

      {node.path && (
        <div className="doc-preview-path">{node.path}</div>
      )}

      <div className="doc-preview-body">
        {loading && <div className="doc-preview-loading">Cargando...</div>}
        {error && <div className="doc-preview-error">{error}</div>}
        {!loading && !error && content && (
          <div
            className="doc-preview-md"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
        {!loading && !error && !content && !hasFile && (
          <div className="doc-preview-no-file">
            Este nodo no tiene archivo asociado.
          </div>
        )}
      </div>
    </div>
  );
}
