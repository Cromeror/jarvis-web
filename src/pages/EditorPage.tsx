import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFile } from '../lib/api.js';
import type { FileContent } from '../lib/api.js';
import type { DocType } from '../lib/markdown-parser.js';
import { Sidebar } from '../components/Sidebar/Sidebar.js';
import { Editor } from '../components/Editor/Editor.js';
import { HistoryPanel } from '../components/History/HistoryPanel.js';
import { Toast, useToast } from '../components/ui/atoms/Toast.js';

/**
 * Main layout: sidebar (left) + editor (center) + history panel (right).
 * Design §Frontend structure. The open file is kept as a `?file=` query
 * param (not a route) since it's transient view state, not a location.
 */
export function EditorPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFile = searchParams.get('file');
  const [activeFile, setActiveFile] = useState<string | null>(initialFile);
  const [fileData, setFileData] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const { toasts, addToast, removeToast } = useToast();

  const loadFile = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const data = await getFile(path);
      setFileData(data);
      setFileContent(data.content);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error cargando archivo', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (activeFile) {
      void loadFile(activeFile);
    } else {
      setFileData(null);
      setFileContent('');
    }
  }, [activeFile, loadFile]);

  const handleFileSelect = (path: string): void => {
    setActiveFile(path);
    setSearchParams({ file: path });
  };

  const handleSave = (warnings: string[]): void => {
    if (warnings.length > 0) {
      warnings.forEach((w) => addToast(w, 'info'));
    }
  };

  const handleRestored = (content: string): void => {
    setFileContent(content);
    addToast('Versión restaurada', 'success');
  };

  return (
    <div className="editor-page">
      <Sidebar activeFile={activeFile} onFileSelect={handleFileSelect} />

      <main className="editor-main">
        {loading && <div className="loading-overlay">Cargando...</div>}
        {!loading && !fileData && (
          <div className="editor-empty">
            <p>Seleccioná un archivo del sidebar.</p>
          </div>
        )}
        {!loading && fileData && (
          <Editor
            key={activeFile ?? ''}
            filePath={fileData.path}
            initialContent={fileContent}
            fileType={fileData.type as DocType}
            onSave={handleSave}
            onVersionSaved={() => {
              addToast('Versión guardada', 'success');
            }}
          />
        )}
      </main>

      {activeFile && fileData && (
        <HistoryPanel
          filePath={activeFile}
          currentContent={fileContent}
          onRestored={handleRestored}
        />
      )}

      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
