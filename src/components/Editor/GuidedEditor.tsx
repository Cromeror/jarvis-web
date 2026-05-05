import React from 'react';
import type { DocType } from '../../lib/markdown-parser.js';
import { getSectionOrder, extractMermaidBlocks, injectMermaidCode } from '../../lib/markdown-parser.js';
import { MermaidEditor } from './MermaidEditor.js';

/** Sections that contain mermaid diagrams */
const MERMAID_SECTIONS: Record<DocType, string[]> = {
  flujo: ['Pasos', 'Casos alternos'],
  arquitectura: ['Diagrama'],
  generico: [],
};

interface GuidedEditorProps {
  sections: Record<string, string>;
  type: DocType;
  onChange: (sections: Record<string, string>) => void;
}

/**
 * Form-based editor: one field per H2 section.
 * Mermaid sections get a split code+preview panel.
 * Design §Editor architecture, REQ-6.
 */
export function GuidedEditor({ sections, type, onChange }: GuidedEditorProps): React.ReactElement {
  const order = getSectionOrder(type);
  const mermaidSections = new Set(MERMAID_SECTIONS[type] ?? []);

  // Show sections in template order, then any extra sections not in order
  const allKeys = [
    ...order.filter((k) => k in sections),
    ...Object.keys(sections).filter((k) => !order.includes(k)),
  ];

  const handleTextChange = (key: string, value: string): void => {
    onChange({ ...sections, [key]: value });
  };

  const handleMermaidChange = (key: string, newCode: string): void => {
    const current = sections[key] ?? '';
    const updated = injectMermaidCode(current, newCode);
    onChange({ ...sections, [key]: updated });
  };

  return (
    <div className="guided-editor">
      {allKeys.map((key) => {
        const content = sections[key] ?? '';
        const isMermaid = mermaidSections.has(key);

        return (
          <div key={key} className="section-block">
            <label className="section-label">{key}</label>
            {isMermaid ? (
              <MermaidEditor
                code={extractMermaidBlocks(content).mermaid}
                onChange={(code) => handleMermaidChange(key, code)}
              />
            ) : (
              <textarea
                className="section-textarea"
                value={content}
                onChange={(e) => handleTextChange(key, e.target.value)}
                placeholder={`Contenido de "${key}"...`}
                rows={4}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
