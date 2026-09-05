import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { DocType } from '../../lib/markdown-parser.js';
import { saveFile, saveVersion } from '../../lib/api.js';
import { ModeToggle } from './ModeToggle.js';
import type { EditorMode } from './ModeToggle.js';
import { RawEditor } from './RawEditor.js';
import { GuidedEditor } from './GuidedEditor.js';
import { CopyPromptBtn } from '../ui/atoms/CopyPromptBtn.js';
import { Button } from '../ui/atoms/Button.js';
import { apiUrl } from '../../lib/api-origin.js';

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
  const [externalChange, setExternalChange] = useState(false);

  // Guided mode is always available now — TipTap handles any markdown.
  const guidedAvailable = true;

  // Reset when file changes
  useEffect(() => {
    setEditorContent(initialContent);
    setDirty(false);
    setSaveStatus('idle');
    setExternalChange(false);
  }, [filePath, initialContent]);

  // SSE: detect external changes (e.g. LLM editing the file)
  useEffect(() => {
    const es = new EventSource(apiUrl(`/api/file/watch?path=${encodeURIComponent(filePath)}`));
    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as { event?: string };
        if (data.event === 'changed') setExternalChange(true);
      } catch { /* ignore malformed events */ }
    };
    return () => es.close();
  }, [filePath]);

  // Autosave — debounce 1500ms (paused when external change detected)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || externalChange) return;

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
      {externalChange && (
        <div className="editor-external-change-banner">
          <span>El archivo fue modificado externamente (posiblemente por la LLM).</span>
          <button type="button" onClick={() => { setExternalChange(false); }}>
            Ignorar
          </button>
        </div>
      )}
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
