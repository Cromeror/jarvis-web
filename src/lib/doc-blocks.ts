/**
 * Splits a Markdown document into a flat sequence of blocks.
 *
 * Two block kinds:
 *   - "md": a chunk of Markdown text (rendered with TipTap WYSIWYG).
 *   - "drawio": a diagram block referenced by `<!-- jarvis:diagram src=... -->`,
 *               optionally followed by a fenced ```toon block that we own.
 *
 * The split preserves the original document order, so that recombining the
 * blocks in order yields the same Markdown structure.
 */

export type DocBlock =
  | { kind: 'md'; content: string }
  | { kind: 'drawio'; src: string; notation: string | null; toonBlock: string | null };

// Marker accepts an optional `notation=<value>` attribute after `src`.
// Examples:
//   <!-- jarvis:diagram src=foo.drawio -->
//   <!-- jarvis:diagram src=foo.drawio notation=ansi-iso-5807 -->
const DRAWIO_MARKER = /<!--\s*jarvis:diagram\s+src=([^\s>]+)(?:\s+notation=([a-z0-9-]+))?\s*-->/i;

export function splitDocument(md: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  let cursor = 0;

  while (cursor < md.length) {
    const remaining = md.slice(cursor);
    const markerMatch = remaining.match(DRAWIO_MARKER);
    if (!markerMatch) {
      const tail = md.slice(cursor);
      if (tail.length > 0) blocks.push({ kind: 'md', content: tail });
      break;
    }

    const markerStart = cursor + (markerMatch.index ?? 0);
    const markerEnd = markerStart + markerMatch[0].length;

    // Push everything before the marker as a md block (if non-empty)
    if (markerStart > cursor) {
      const before = md.slice(cursor, markerStart);
      if (before.trim()) {
        blocks.push({ kind: 'md', content: stripTrailingBlankLines(before) });
      }
    }

    // Look for an optional adjacent ```toon block right after the marker
    const afterMarker = md.slice(markerEnd);
    const toonMatch = afterMarker.match(/^\s*\n(```toon\n[\s\S]*?```)/);
    let toonBlock: string | null = null;
    let nextCursor = markerEnd;
    if (toonMatch) {
      toonBlock = toonMatch[1] ?? null;
      nextCursor = markerEnd + (toonMatch[0]?.length ?? 0);
    }

    blocks.push({
      kind: 'drawio',
      src: markerMatch[1] ?? '',
      notation: markerMatch[2] ?? null,
      toonBlock,
    });
    cursor = nextCursor;
  }

  return blocks;
}

export function joinDocument(blocks: DocBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'md') {
      parts.push(b.content);
    } else {
      const toon = b.toonBlock ?? defaultEmptyToon(b.notation);
      const marker = b.notation
        ? `<!-- jarvis:diagram src=${b.src} notation=${b.notation} -->`
        : `<!-- jarvis:diagram src=${b.src} -->`;
      parts.push(`${marker}\n\n${toon}`);
    }
  }
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Replace the toon block of the drawio block whose `src` matches. */
export function updateToonBlock(
  blocks: DocBlock[],
  src: string,
  newToon: string,
): DocBlock[] {
  const fence = '```toon\n' + newToon + '\n```';
  return blocks.map((b) =>
    b.kind === 'drawio' && b.src === src ? { ...b, toonBlock: fence } : b,
  );
}

/** Replace an md block's content by index. */
export function updateMdBlock(
  blocks: DocBlock[],
  index: number,
  newContent: string,
): DocBlock[] {
  return blocks.map((b, i) =>
    i === index && b.kind === 'md' ? { ...b, content: newContent } : b,
  );
}

function stripTrailingBlankLines(s: string): string {
  return s.replace(/\n+$/, '');
}

/** Empty-state TOON for a freshly inserted diagram block, tagged with the notation. */
function defaultEmptyToon(notation: string | null): string {
  if (notation === 'ansi-iso-5807') {
    return '```toon\ndiagram: flow\nnotation: ansi-iso-5807\ndirection: LR\nnodes[0]{id,label,shape}:\nedges[0]{from,to,label}:\n```';
  }
  return '```toon\ndiagram: flow\ndirection: LR\ngroups[0]{id,label}:\nnodes[0]{id,label,shape,group}:\nedges[0]{from,to,label}:\n```';
}
