import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { DocType } from '../../lib/markdown-parser.js';
import { saveFile, saveVersion } from '../../lib/api.js';
import { ModeToggle } from './ModeToggle.js';
import type { EditorMode } from './ModeToggle.js';
import { RawEditor } from './RawEditor.js';
import { GuidedEditor } from './GuidedEditor.js';
import { CopyPromptBtn } from '../ui/CopyPromptBtn.js';
import { Button } from '../ui/Button.js';

interface EditorProps {
  filePath: string;
  initialContent: string;
  fileType: DocType;
  onSave?: (warnings: string[]) => void;
  onVersionSaved?: () => void;
}

/**
 * Orchestrator editor: manages canonical editorContent, mode switching,
 * autosave, and version saving.
 * Design §Editor architecture, REQ-6, REQ-8.
 */
export function Editor({
  filePath,
  initialContent,
  fileType,
  onSave,
  onVersionSaved,
}: EditorProps): React.ReactElement {
  const [editorContent, setEditorContent] = useState(initialContent);
  const [mode, setMode] = useState<EditorMode>('guided');
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [savingVersion, setSavingVersion] = useState(false);

  // Guided mode is always available now — TipTap handles any markdown.
  const guidedAvailable = true;

  // Reset when file changes
  useEffect(() => {
    setEditorContent(initialContent);
    setDirty(false);
    setSaveStatus('idle');
  }, [filePath, initialContent]);

  // Autosave — debounce 1500ms
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const result = await saveFile(filePath, editorContent);
        setSaveStatus('saved');
        setDirty(false);
        if (onSave) onSave(result.warnings ?? []);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [editorContent, dirty, filePath, onSave]);

  const handleContentChange = useCallback((content: string) => {
    setEditorContent(content);
    setDirty(true);
    setSaveStatus('idle');
  }, []);

  const handleGuidedChange = useCallback((newContent: string) => {
    setEditorContent((prev) => {
      if (prev === newContent) return prev;
      setDirty(true);
      setSaveStatus('idle');
      return newContent;
    });
  }, []);

  const handleModeChange = (newMode: EditorMode): void => {
    setMode(newMode);
  };

  const handleSaveVersion = async (): Promise<void> => {
    setSavingVersion(true);
    try {
      const result = await saveVersion(filePath);
      if (result.skipped) {
        alert('Sin cambios desde la última versión guardada.');
      } else {
        alert(`Versión guardada: ${result.version ?? ''}`);
        if (onVersionSaved) onVersionSaved();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error guardando versión');
    } finally {
      setSavingVersion(false);
    }
  };

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <ModeToggle
          mode={mode}
          guided={guidedAvailable}
          dirty={dirty}
          onChange={handleModeChange}
        />
        <div className="editor-toolbar-right">
          <span className={`save-status save-status-${saveStatus}`}>
            {saveStatus === 'saving' && 'Guardando...'}
            {saveStatus === 'saved' && 'Guardado'}
          </span>
          <Button
            variant="secondary"
            disabled={savingVersion}
            onClick={() => void handleSaveVersion()}
          >
            {savingVersion ? 'Guardando...' : 'Guardar versión'}
          </Button>
          <CopyPromptBtn filePath={filePath} />
        </div>
      </div>

      <div className="editor-body">
        {mode === 'raw' ? (
          <RawEditor content={editorContent} onChange={handleContentChange} />
        ) : (
          <GuidedEditor
            content={editorContent}
            currentDocPath={filePath}
            onChange={handleGuidedChange}
          />
        )}
      </div>
    </div>
  );
}
