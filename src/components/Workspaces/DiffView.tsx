import React, { useMemo } from 'react';
import { parseUnifiedDiff, countDiffLines, type DiffLine } from '../../lib/diff-view.js';
import type { FileDiffResponse } from '../../lib/workspace-changes-api.js';
import { Icon } from '../Icon.js';

interface DiffViewProps {
  diff: FileDiffResponse;
  /**
   * Texto de origen del patch, arriba del diff. `null` lo oculta.
   *
   * El default lo deriva de `source`, que describe de donde sale un diff del
   * WORKING TREE ("indice contra HEAD", "sin stagear"). El patch de un commit
   * es el mismo formato pero no tiene ese origen, y ahi la etiqueta derivada
   * seria una afirmacion falsa sobre lo que se esta mirando.
   */
  sourceLabel?: string | null;
}

const LINE_CLASS: Record<DiffLine['type'], string> = {
  add: 'bg-[var(--sw-success-bg)] text-[var(--sw-on-success)]',
  del: 'bg-[var(--sw-error-bg)] text-[var(--sw-on-error)]',
  context: 'text-foreground',
  meta: 'text-muted-foreground italic',
};

const SIGN: Record<DiffLine['type'], string> = { add: '+', del: '-', context: ' ', meta: '\\' };

/** Aviso corto arriba del diff — para el binario, el truncado y el error. */
function Notice({ tone, children }: { tone: 'info' | 'warning' | 'danger'; children: React.ReactNode }): React.ReactElement {
  const cls = {
    info: 'border-border bg-muted text-secondary-foreground',
    warning: 'border-[var(--sw-warning)] bg-[var(--sw-warning-bg)] text-[var(--sw-on-warning)]',
    danger: 'border-[var(--sw-error)] bg-[var(--sw-error-bg)] text-[var(--sw-on-error)]',
  }[tone];
  return <div className={`flex items-center gap-2 rounded-[var(--sw-r-md)] border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/**
 * Diff unificado con resaltado por línea, de solo lectura.
 *
 * Unificado y no lado a lado: para "saber qué modifiqué" alcanza y sobra, ocupa
 * la mitad del ancho —así el panel convive con la lista de archivos sin
 * scroll horizontal— y es el formato que ya se lee en `git diff` y en las
 * reviews de GitHub. El lado a lado recién paga cuando hay que comparar
 * bloques largos reescritos, que no es el caso de uso de esta pantalla.
 *
 * Los tres casos en los que NO hay diff que dibujar se muestran como tales, no
 * como un panel vacío: binario, truncado, y error de git.
 */
export function DiffView({ diff, sourceLabel }: DiffViewProps): React.ReactElement {
  const parsed = useMemo(() => parseUnifiedDiff(diff.diff), [diff.diff]);
  const shown = useMemo(() => countDiffLines(parsed), [parsed]);
  const origin = sourceLabel !== undefined
    ? sourceLabel
    : diff.source === 'staged' ? 'índice contra HEAD' : diff.source === 'untracked' ? 'archivo nuevo' : 'sin stagear';

  if (diff.error) {
    return <Notice tone="danger">{diff.error}</Notice>;
  }

  if (diff.binary) {
    return (
      <Notice tone="info">
        <Icon name="archivo" />
        Archivo binario — no hay diff de texto para mostrar.
      </Notice>
    );
  }

  if (parsed.hunks.length === 0) {
    // Truncado tan temprano que no quedó ni un hunk completo: hay cambios, pero
    // no entran en el tope. Distinto de un archivo realmente sin cambios.
    if (diff.truncated || parsed.repaired) {
      return (
        <Notice tone="warning">
          El diff de este archivo es demasiado grande para mostrarlo
          {diff.added_lines !== null && <> ({diff.added_lines} líneas agregadas, {diff.deleted_lines} borradas)</>}.
        </Notice>
      );
    }
    if (parsed.unparsed) {
      return (
        <>
          <Notice tone="warning">No se pudo interpretar este diff; se muestra tal cual lo devolvió git.</Notice>
          <pre className="mt-3 overflow-x-auto rounded-[var(--sw-r-md)] border border-border bg-muted p-4 font-mono text-xs text-foreground">{diff.diff}</pre>
        </>
      );
    }
    return <Notice tone="info">Sin cambios para mostrar en este archivo.</Notice>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-mono text-[var(--sw-success)]">+{diff.added_lines ?? shown.added}</span>
        <span className="font-mono text-[var(--sw-error)]">−{diff.deleted_lines ?? shown.deleted}</span>
        {origin !== null && <span className="text-muted-foreground">{origin}</span>}
      </div>

      {(diff.truncated || parsed.repaired) && (
        <Notice tone="warning">
          El diff está cortado por tamaño: se muestran {shown.added + shown.deleted} de{' '}
          {(diff.added_lines ?? 0) + (diff.deleted_lines ?? 0)} líneas cambiadas.
        </Notice>
      )}

      <div className="overflow-x-auto rounded-[var(--sw-r-md)] border border-border">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {parsed.hunks.map((hunk, hunkIndex) => (
              <React.Fragment key={`${hunk.header}-${hunkIndex}`}>
                <tr>
                  <td colSpan={3} className="bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                    {hunk.header}
                  </td>
                </tr>
                {hunk.lines.map((line, lineIndex) => (
                  <tr key={`${hunkIndex}-${lineIndex}`} className={LINE_CLASS[line.type]}>
                    {/* Los dos números de línea: el viejo y el nuevo, como en
                        GitHub. `select-none` para que copiar el diff no se
                        lleve los números puestos. */}
                    <td className="w-12 select-none border-r border-border px-2 py-0.5 text-right opacity-60">
                      {line.oldNumber ?? ''}
                    </td>
                    <td className="w-12 select-none border-r border-border px-2 py-0.5 text-right opacity-60">
                      {line.newNumber ?? ''}
                    </td>
                    <td className="whitespace-pre px-3 py-0.5">
                      <span className="select-none opacity-60">{SIGN[line.type]}</span>
                      {line.content}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
