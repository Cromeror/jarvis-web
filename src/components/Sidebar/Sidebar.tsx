import React, { useState, useEffect, useCallback } from 'react';
import { listFiles, createFile } from '../../lib/api.js';
import type { FileEntry } from '../../lib/api.js';
import type { DocType } from '../../lib/markdown-parser.js';
import { SearchBox } from './SearchBox.js';
import { FileTree } from './FileTree.js';
import { Button } from '../ui/atoms/Button.js';

interface SidebarProps {
  activeFile: string | null;
  onFileSelect: (path: string) => void;
}

interface NewFileModal {
  name: string;
  type: DocType;
}

export function Sidebar({ activeFile, onFileSelect }: SidebarProps): React.ReactElement {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newFile, setNewFile] = useState<NewFileModal>({ name: '', type: 'generico' });
  const [creating, setCreating] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listFiles();
      setFiles(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando archivos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleCreateFile = async (): Promise<void> => {
    if (!newFile.name) return;
    setCreating(true);
    try {
      // Determine folder from type, build path
      const folder = newFile.type === 'generico' ? '' : `${newFile.type}s/`;
      const filename = newFile.name.endsWith('.md') ? newFile.name : `${newFile.name}.md`;
      const path = folder ? `${folder}${filename}` : filename;
      await createFile(path, newFile.type);
      setShowModal(false);
      setNewFile({ name: '', type: 'generico' });
      await loadFiles();
      onFileSelect(path);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creando archivo');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Archivos</span>
        <Button
          variant="ghost"
          onClick={() => setShowModal(true)}
          title="Nuevo archivo"
          className="btn-icon"
        >
          +
        </Button>
      </div>

      <SearchBox value={searchValue} onSearch={setSearchValue} />

      <div className="sidebar-files">
        {loading && <div className="loading">Cargando...</div>}
        {error && (
          <div className="error-msg">
            {error}{' '}
            <button onClick={() => void loadFiles()} className="retry-btn">
              Reintentar
            </button>
          </div>
        )}
        {!loading && !error && (
          <FileTree
            files={files}
            searchValue={searchValue}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
          />
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nuevo archivo</h3>
            <div className="form-group">
              <label htmlFor="new-file-name">Nombre</label>
              <input
                id="new-file-name"
                type="text"
                value={newFile.name}
                onChange={(e) => setNewFile((v) => ({ ...v, name: e.target.value }))}
                placeholder="login.md"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && void handleCreateFile()}
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-file-type">Tipo</label>
              <select
                id="new-file-type"
                value={newFile.type}
                onChange={(e) => setNewFile((v) => ({ ...v, type: e.target.value as DocType }))}
              >
                <option value="flujo">Flujo</option>
                <option value="arquitectura">Arquitectura</option>
                <option value="generico">Genérico</option>
              </select>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={!newFile.name || creating}
                onClick={() => void handleCreateFile()}
              >
                {creating ? 'Creando...' : 'Crear'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
