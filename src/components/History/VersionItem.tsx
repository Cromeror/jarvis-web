import React from 'react';
import type { VersionEntry } from '../../lib/api.js';
import { formatSnapshotTimestamp } from '../../lib/snapshot-name.js';
import { Button } from '../ui/atoms/Button.js';

interface VersionItemProps {
  version: VersionEntry;
  onRestore: (version: string) => void;
}

export function VersionItem({ version, onRestore }: VersionItemProps): React.ReactElement {
  const label = formatSnapshotTimestamp(version.version);
  const sizeKb = (version.size / 1024).toFixed(1);

  return (
    <div className="version-item">
      <div className="version-info">
        <span className="version-timestamp">{label}</span>
        <span className="version-size">{sizeKb} KB</span>
      </div>
      <Button
        variant="ghost"
        onClick={() => onRestore(version.version)}
        title={`Restaurar versión del ${label}`}
      >
        Restaurar
      </Button>
    </div>
  );
}
