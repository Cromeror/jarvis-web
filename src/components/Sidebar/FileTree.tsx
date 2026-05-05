import React from 'react';
import type { FileEntry } from '../../lib/api.js';

interface FileTreeProps {
  files: FileEntry[];
  searchValue: string;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
}

interface FolderNode {
  [key: string]: FolderNode | FileEntry;
}

function buildTree(files: FileEntry[]): FolderNode {
  const root: FolderNode = {};
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!node[part]) node[part] = {} as FolderNode;
      node = node[part] as FolderNode;
    }
    const filename = parts[parts.length - 1]!;
    node[filename] = file;
  }
  return root;
}

function isFileEntry(val: unknown): val is FileEntry {
  return typeof val === 'object' && val !== null && 'path' in val;
}

interface TreeNodeProps {
  name: string;
  node: FolderNode | FileEntry;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  depth: number;
}

function TreeNode({
  name,
  node,
  activeFile,
  onFileSelect,
  depth,
}: TreeNodeProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(true);

  if (isFileEntry(node)) {
    const isActive = node.path === activeFile;
    return (
      <div
        className={`file-item ${isActive ? 'file-item-active' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onFileSelect(node.path)}
        title={node.path}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onFileSelect(node.path)}
      >
        <span className="file-icon">&#x1F4C4;</span>
        <span className="file-name">{name}</span>
      </div>
    );
  }

  const children = Object.entries(node as FolderNode).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="folder-item">
      <div
        className="folder-header"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
      >
        <span className="folder-icon">{expanded ? '▼' : '▶'}</span>
        <span className="folder-name">{name}</span>
      </div>
      {expanded && (
        <div className="folder-children">
          {children.map(([childName, childNode]) => (
            <TreeNode
              key={childName}
              name={childName}
              node={childNode as FolderNode | FileEntry}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  files,
  searchValue,
  activeFile,
  onFileSelect,
}: FileTreeProps): React.ReactElement {
  const filtered = searchValue
    ? files.filter((f) => f.path.toLowerCase().includes(searchValue.toLowerCase()))
    : files;

  if (searchValue && filtered.length === 0) {
    return <div className="no-results">Sin resultados para "{searchValue}"</div>;
  }

  if (filtered.length === 0) {
    return <div className="no-results">No hay archivos en docs/</div>;
  }

  // When searching, show flat list; otherwise show tree
  if (searchValue) {
    return (
      <div className="file-list-flat">
        {filtered.map((file) => (
          <div
            key={file.path}
            className={`file-item ${file.path === activeFile ? 'file-item-active' : ''}`}
            style={{ paddingLeft: '8px' }}
            onClick={() => onFileSelect(file.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onFileSelect(file.path)}
            title={file.path}
          >
            <span className="file-icon">&#x1F4C4;</span>
            <span className="file-name">{file.path}</span>
          </div>
        ))}
      </div>
    );
  }

  const tree = buildTree(filtered);
  const entries = Object.entries(tree).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="file-tree">
      {entries.map(([name, node]) => (
        <TreeNode
          key={name}
          name={name}
          node={node as FolderNode | FileEntry}
          activeFile={activeFile}
          onFileSelect={onFileSelect}
          depth={0}
        />
      ))}
    </div>
  );
}
