import React from 'react';
import { Spinner } from '../ui/atoms/Spinner.js';
import { DiffView } from './DiffView.js';
import type { CommitDetailResponse } from '../../lib/workspace-history-api.js';

interface CommitDetailPanelProps {
  detail: CommitDetailResponse | null;
  loading: boolean;
}

/**
 * Detalle de un commit: quien, cuando, que archivos toco y su diff.
 *
 * El diff lo pinta `DiffView`, el mismo del panel de cambios — el patch de un
 * commit y el de un working tree son el mismo formato unificado de git, asi que
 * un segundo visor solo agregaria una segunda forma de tener el mismo bug. Le
 * paso el shape que `DiffView` espera, incluida la marca de truncado.
 */
export function CommitDetailPanel({ detail, loading }: CommitDetailPanelProps): React.ReactElement {
  if (loading && !detail) {
    return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner /> Leyendo el commit…</div>;
  }
  if (!detail) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Elegi un commit del grafo para ver su detalle.</p>;
  }
  if (detail.error && !detail.commit) {
    return (
      <div className="rounded-[var(--sw-r-md)] border border-[var(--sw-error)] bg-[var(--sw-error-bg)] px-4 py-3 text-sm text-[var(--sw-on-error)]">
        {detail.error}
      </div>
    );
  }

  const commit = detail.commit;
  const totalAdded = detail.files.reduce((n, f) => n + (f.added ?? 0), 0);
  const totalDeleted = detail.files.reduce((n, f) => n + (f.deleted ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {commit && (
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-medium text-foreground">{commit.subject}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{commit.hash.slice(0, 10)}</span>
            {' · '}{commit.author_name} &lt;{commit.author_email}&gt;
            {' · '}{new Date(commit.date).toLocaleString()}
          </p>
          {commit.is_merge && (
            // `git show` no muestra nada de un merge sin decirle contra que
            // padre diffear; el backend usa --first-parent y hay que decirlo.
            <p className="mt-2 rounded-[var(--sw-r-sm)] bg-muted px-2 py-1 text-xs text-muted-foreground">
              Merge de {commit.parents.length} padres — se muestra lo que trajo, contra el primero.
            </p>
          )}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {detail.files.length} archivo{detail.files.length === 1 ? '' : 's'}
          {' · '}<span className="text-[var(--sw-success)]">+{totalAdded}</span>
          {' '}<span className="text-[var(--sw-error)]">−{totalDeleted}</span>
        </p>
        <ul className="max-h-40 divide-y divide-border overflow-auto rounded-[var(--sw-r-md)] border border-border">
          {detail.files.map((f) => (
            <li key={f.path} className="flex items-center gap-2 px-3 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate font-mono text-secondary-foreground" title={f.path}>
                {f.orig_path ? `${f.orig_path} → ${f.path}` : f.path}
              </span>
              {f.binary ? (
                <span className="shrink-0 text-muted-foreground">binario</span>
              ) : (
                <span className="shrink-0 font-mono">
                  <span className="text-[var(--sw-success)]">+{f.added}</span>{' '}
                  <span className="text-[var(--sw-error)]">−{f.deleted}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <DiffView
        diff={{
          root_path: detail.root_path,
          path: commit?.hash ?? '',
          // `source` describe de donde sale un diff del working tree; un commit
          // no tiene ese origen. El campo es obligatorio en el shape, asi que se
          // pone el neutro y la etiqueta se apaga con `sourceLabel={null}`.
          source: 'staged',
          binary: false,
          truncated: detail.truncated,
          diff: detail.diff,
          added_lines: totalAdded,
          deleted_lines: totalDeleted,
          error: detail.commit ? null : detail.error,
        }}
        sourceLabel={null}
      />
    </div>
  );
}
