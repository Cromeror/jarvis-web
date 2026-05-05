import React, { useState, useEffect, useCallback } from 'react';
import { listVersions, saveVersion, restoreVersion, saveFile, getFile } from '../../lib/api.js';
import type { VersionEntry } from '../../lib/api.js';
import { VersionItem } from './VersionItem.js';
import { Button } from '../ui/Button.js';

interface HistoryPanelProps {
  filePath: string;
  currentContent: string;
  onRestored: (content: string) => void;
}

/**
 * Collapsible right sidebar with version history.
 * Design §Frontend structure, REQ-9, REQ-11.
 */
export function HistoryPanel({
  filePath,
  currentContent,
  onRestored,
}: HistoryPanelProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(true);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listVersions(filePath);
      setVersions(result);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    if (!collapsed) {
      void loadVersions();
    }
  }, [collapsed, loadVersions]);

  // Reload when filePath changes
  useEffect(() => {
    setVersions([]);
  }, [filePath]);

  const handleSaveVersion = async (): Promise<void> => {
    setSavingVersion(true);
    try {
      const result = await saveVersion(filePath);
      if (result.skipped) {
        alert('Sin cambios desde la última versión.');
      } else {
        await loadVersions();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error guardando versión');
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestore = async (version: string): Promise<void> => {
    const confirmed = confirm(`¿Restaurar versión del ${version}? Se sobrescribirá el archivo actual.`);
    if (!confirmed) return;

    try {
      await restoreVersion(filePath, version);
      // Re-read the file after restore and notify parent
      // Trigger autosave immediately (REQ-11)
      const restored = await getFile(filePath);
      // Trigger autosave immediately (REQ-11)
      await saveFile(filePath, restored.content);
      onRestored(restored.content);
      await loadVersions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error restaurando versión');
    }
  };

  return (
    <div className={`history-panel ${collapsed ? 'history-panel-collapsed' : ''}`}>
      <div className="history-panel-header" onClick={() => setCollapsed((v) => !v)}>
        <span className="history-panel-title">{collapsed ? '◀' : '▶'} Historial</span>
      </div>

      {!collapsed && (
        <div className="history-panel-body">
          <div className="history-actions">
            <Button
              variant="secondary"
              disabled={savingVersion}
              onClick={() => void handleSaveVersion()}
            >
              {savingVersion ? 'Guardando...' : 'Guardar versión'}
            </Button>
          </div>

          {loading && <div className="loading">Cargando versiones...</div>}

          {!loading && versions.length === 0 && (
            <div className="no-versions">Sin versiones guardadas</div>
          )}

          {!loading && versions.length > 0 && (
            <div className="version-list">
              {versions.map((v) => (
                <VersionItem
                  key={v.version}
                  version={v}
                  onRestore={(ver) => void handleRestore(ver)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
