import React, { useEffect, useMemo, useState } from 'react';
import { DrawioEditor } from './DrawioEditor.js';
import { MdSectionEditor } from './MdSectionEditor.js';
import {
  splitDocument,
  joinDocument,
  updateMdBlock,
  updateToonBlock,
  type DocBlock,
} from '../../lib/doc-blocks.js';

interface Props {
  /** Full Markdown of the document. */
  content: string;
  /** Path of the .md under docs/, used to resolve relative drawio refs. */
  currentDocPath: string;
  /** Called whenever the user edits anything. */
  onChange: (markdown: string) => void;
}

/**
 * Document-level guided editor.
 * Splits the markdown into a flat sequence of blocks and renders:
 *   - text/blockquote/list/heading content with a TipTap WYSIWYG editor.
 *   - drawio markers with the embedded drawio iframe.
 * The original order is preserved so the diagram appears exactly where it
 * lives in the source document.
 */
export function GuidedEditor({
  content,
  currentDocPath,
  onChange,
}: Props): React.ReactElement {
  const [blocks, setBlocks] = useState<DocBlock[]>(() => splitDocument(content));

  // Re-split when the source content changes from outside (file switch, restore)
  useEffect(() => {
    setBlocks(splitDocument(content));
  }, [content]);

  // Push joined doc upstream whenever blocks change
  useEffect(() => {
    onChange(joinDocument(blocks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const handleMdChange = (idx: number) => (md: string): void => {
    setBlocks((prev) => updateMdBlock(prev, idx, md));
  };

  const handleDrawioSave = (src: string) => async (
    xml: string,
    toon: string,
  ): Promise<void> => {
    const fullDrawioPath = resolveRelative(currentDocPath, src);
    try {
      const res = await fetch('/api/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullDrawioPath, content: xml }),
      });
      if (!res.ok) {
        // Fallback to POST if PUT failed
        await fetch('/api/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: fullDrawioPath, content: xml }),
        });
      }
    } catch {
      // ignore network errors here; user keeps editing
    }
    setBlocks((prev) => updateToonBlock(prev, src, toon));
  };

  return (
    <div className="guided-editor">
      {blocks.map((block, idx) => {
        if (block.kind === 'drawio') {
          return (
            <div key={`d-${idx}`} className="doc-drawio-block">
              <LazyDrawioBlock
                drawioPath={resolveRelative(currentDocPath, block.src)}
                notation={block.notation}
                onSave={handleDrawioSave(block.src)}
              />
            </div>
          );
        }
        return (
          <div key={`m-${idx}`} className="doc-md-block">
            <MdSectionEditor
              content={block.content}
              onChange={handleMdChange(idx)}
            />
          </div>
        );
      })}
    </div>
  );
}

function LazyDrawioBlock({
  drawioPath,
  notation,
  onSave,
}: {
  drawioPath: string;
  notation: string | null;
  onSave: (xml: string, toon: string) => Promise<void>;
}): React.ReactElement {
  const [xml, setXml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/file?path=' + encodeURIComponent(drawioPath));
        if (res.status === 404) {
          if (!cancelled) setXml('');
          return;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = (await res.json()) as { content?: string };
        if (!cancelled) setXml(data.content ?? '');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawioPath]);

  if (error) return <div className="error-msg">Error cargando diagrama: {error}</div>;
  if (xml === null) return <div className="loading">Cargando diagrama…</div>;
  return <DrawioEditor initialXml={xml} notation={notation} onSave={onSave} />;
}

function resolveRelative(docPath: string, relPath: string): string {
  const parts = docPath.split('/');
  parts.pop();
  return [...parts, ...relPath.split('/')].filter(Boolean).join('/');
}
