import React, { useState } from 'react';
import { getProjectContext } from '../../lib/projects-api.js';
import type { ContextFormat } from '../../lib/projects-api.js';
import { Button } from '../ui/Button.js';

interface ContextPanelProps {
  projectId: string;
}

/**
 * Sidebar panel: fetches and displays project context in YAML or toon format.
 * Spec §3.2, T10.
 */
export function ContextPanel({ projectId }: ContextPanelProps): React.ReactElement {
  const [format, setFormat] = useState<ContextFormat>('yaml');
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = (): void => {
    setLoading(true);
    setError(null);
    getProjectContext(projectId, format)
      .then((res) => setContent(res.content))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Error fetching context');
      })
      .finally(() => setLoading(false));
  };

  const handleCopy = (): void => {
    if (!content) return;
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="context-panel">
      <div className="context-panel-header">
        <span className="context-panel-title">Context</span>
        <div className="context-panel-controls">
          <select
            className="context-panel-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as ContextFormat)}
          >
            <option value="yaml">YAML</option>
            <option value="toon">Toon</option>
          </select>
          <Button variant="primary" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Loading…' : 'Generate'}
          </Button>
        </div>
      </div>

      {error && <div className="context-panel-error">{error}</div>}

      {content && (
        <>
          <div className="context-panel-actions">
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <pre className="context-panel-content">{content}</pre>
        </>
      )}

      {!content && !error && !loading && (
        <div className="context-panel-empty">
          Click Generate to load the project context.
        </div>
      )}
    </div>
  );
}
