import React, { useState } from 'react';
import { EditorPage } from './pages/EditorPage.js';

/**
 * Root app component.
 * Routing is query-string based: ?file=<path> → EditorPage, else → ExplorerPage.
 * No react-router — uses useState + URLSearchParams.
 * Design §Frontend structure, REQ-12.
 */
export default function App(): React.ReactElement {
  const getFileFromUrl = (): string | null => {
    const params = new URLSearchParams(window.location.search);
    return params.get('file');
  };

  const [currentFile, setCurrentFile] = useState<string | null>(getFileFromUrl);

  const handleFileChange = (path: string | null): void => {
    setCurrentFile(path);
  };

  // Listen for browser navigation (back/forward)
  React.useEffect(() => {
    const handlePopState = (): void => {
      setCurrentFile(getFileFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Always use EditorPage (it handles both states: file selected and no file selected)
  return <EditorPage initialFile={currentFile} onFileChange={handleFileChange} />;
}
