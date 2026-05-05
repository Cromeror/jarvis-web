/**
 * Markdown section parser and serializer.
 * Design §Editor architecture — Mode guiado.
 */

export type DocType = 'flujo' | 'arquitectura' | 'generico';

/** Section order per document type — used for serialization */
const SECTION_ORDER: Record<DocType, string[]> = {
  flujo: [
    'Resumen',
    'Actores',
    'Precondiciones',
    'Pasos',
    'Casos alternos',
    'Reglas de negocio',
    'Notas',
    'Referencias',
  ],
  arquitectura: ['Resumen', 'Diagrama', 'Componentes', 'Dependencias', 'Decisiones', 'Referencias'],
  generico: ['Resumen', 'Notas', 'Referencias'],
};

export interface ParsedDoc {
  title: string;
  sections: Record<string, string>;
}

/**
 * Parses a Markdown document into its H2 sections.
 * Returns null if no H2 sections are found (triggers raw fallback).
 * Design §parseMarkdownSections.
 */
export function parseSections(md: string, _type: DocType): ParsedDoc | null {
  const h1Match = md.match(/^# (.+)$/m);
  const title = h1Match ? h1Match[1].trim() : '';

  const h2Regex = /^## (.+)$/gm;
  const positions: Array<{ title: string; start: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = h2Regex.exec(md)) !== null) {
    positions.push({ title: match[1].trim(), start: match.index });
  }

  if (positions.length === 0) return null;

  const sections: Record<string, string> = {};
  for (let i = 0; i < positions.length; i++) {
    // Content starts after "## <title>\n"
    const headerLine = `## ${positions[i].title}`;
    const start = positions[i].start + headerLine.length + 1; // +1 for \n
    const end = i + 1 < positions.length ? positions[i + 1].start : md.length;
    sections[positions[i].title] = md.slice(start, end).trim();
  }

  return { title, sections };
}

/**
 * Reconstructs a full Markdown string from parsed sections,
 * preserving template section order.
 * Design §serializeMarkdownSections.
 */
export function serializeSections(parsed: ParsedDoc, type: DocType): string {
  const order = SECTION_ORDER[type];
  const allKeys = new Set([...order, ...Object.keys(parsed.sections)]);
  const orderedKeys = [
    ...order.filter((k) => allKeys.has(k)),
    ...Object.keys(parsed.sections).filter((k) => !order.includes(k)),
  ];

  const lines: string[] = [];
  if (parsed.title) {
    lines.push(`# ${parsed.title}`, '');
  }

  for (const key of orderedKeys) {
    if (!(key in parsed.sections)) continue;
    lines.push(`## ${key}`, '');
    const content = parsed.sections[key];
    if (content) {
      lines.push(content, '');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}

export interface MermaidBlock {
  before: string;
  mermaid: string;
  after: string;
}

/**
 * Finds the first ```mermaid ... ``` block in a section content.
 * Returns before/mermaid/after parts.
 * Design §Mermaid integration.
 */
export function extractMermaidBlocks(content: string): MermaidBlock {
  const m = content.match(/([\s\S]*?)```mermaid\n([\s\S]*?)```([\s\S]*)/);
  if (!m) {
    return { before: content, mermaid: '', after: '' };
  }
  return {
    before: m[1] ?? '',
    mermaid: m[2] ?? '',
    after: m[3] ?? '',
  };
}

/**
 * Injects updated mermaid code back into a section content string.
 */
export function injectMermaidCode(content: string, code: string): string {
  return content.replace(/```mermaid\n[\s\S]*?```/, '```mermaid\n' + code + '\n```');
}

/** Returns the ordered list of sections for a given doc type */
export function getSectionOrder(type: DocType): string[] {
  return SECTION_ORDER[type] ?? [];
}
