import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

interface Props {
  /** Markdown content of the section. */
  content: string;
  /** Called whenever the markdown changes (debounced upstream by Editor.tsx). */
  onChange: (markdown: string) => void;
}

/**
 * WYSIWYG markdown editor for a single document section.
 * - Renders headers, lists, blockquotes, code, bold, italic, links inline.
 * - Toolbar gives quick access to common styles.
 * - Round-trips through tiptap-markdown so the persisted source stays Markdown.
 */
export function MdSectionEditor({ content, onChange }: Props): React.ReactElement {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: '-',
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const md = (editor.storage.markdown as { getMarkdown(): string }).getMarkdown();
      onChange(md);
    },
  });

  // Keep external changes in sync (e.g. when switching files)
  useEffect(() => {
    if (!editor) return;
    const current = (editor.storage.markdown as { getMarkdown(): string }).getMarkdown();
    if (current !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return <div className="loading">Cargando editor…</div>;

  const isActive = (name: string, attrs?: Record<string, unknown>): boolean =>
    attrs ? editor.isActive(name, attrs) : editor.isActive(name);

  return (
    <div className="md-section-editor">
      <div className="md-toolbar">
        <button
          type="button"
          className={isActive('bold') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrita"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={isActive('italic') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Cursiva"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={isActive('strike') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Tachado"
        >
          <s>S</s>
        </button>
        <span className="md-separator" />
        <button
          type="button"
          className={isActive('heading', { level: 2 }) ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Encabezado 2"
        >
          H2
        </button>
        <button
          type="button"
          className={isActive('heading', { level: 3 }) ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Encabezado 3"
        >
          H3
        </button>
        <span className="md-separator" />
        <button
          type="button"
          className={isActive('bulletList') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista"
        >
          • Lista
        </button>
        <button
          type="button"
          className={isActive('orderedList') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          1. Lista
        </button>
        <span className="md-separator" />
        <button
          type="button"
          className={isActive('blockquote') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Cita"
        >
          ❝
        </button>
        <button
          type="button"
          className={isActive('code') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Código inline"
        >
          {'<>'}
        </button>
        <button
          type="button"
          className={isActive('codeBlock') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Bloque de código"
        >
          {'{ }'}
        </button>
      </div>
      <EditorContent editor={editor} className="md-content" />
    </div>
  );
}
