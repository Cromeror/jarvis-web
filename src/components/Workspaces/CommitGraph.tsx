import React from 'react';
import { laneColor, type GraphRow } from '../../lib/graph-view.js';
import type { CommitRef } from '../../lib/workspace-history-api.js';
import { timeAgo } from '../../lib/time-ago.js';

interface CommitGraphProps {
  rows: GraphRow[];
  laneCount: number;
  selectedHash: string | undefined;
  onSelect: (hash: string) => void;
}

/** Alto de fila y ancho de carril: el SVG y la lista comparten esta grilla. */
const ROW_H = 34;
const LANE_W = 16;
const LEFT_PAD = 12;

const laneX = (lane: number): number => LEFT_PAD + lane * LANE_W;

const REF_CLASS: Record<CommitRef['type'], string> = {
  head: 'bg-indigo-600 text-white',
  branch: 'bg-indigo-100 text-indigo-700',
  remote: 'bg-slate-100 text-slate-600',
  tag: 'bg-amber-100 text-amber-700',
};

function RefChip({ refItem }: { refItem: CommitRef }): React.ReactElement {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${REF_CLASS[refItem.type]}`}>
      {refItem.type === 'tag' && <i className="pi pi-tag mr-1 text-[8px]" />}
      {refItem.name}
    </span>
  );
}

/**
 * El grafo: una columna de SVG con los carriles y, al lado, una fila por commit.
 *
 * Van juntos y no en dos componentes porque comparten la grilla — cada fila
 * mide `ROW_H` en los dos lados, y ahi se apoya toda la alineacion. Separarlos
 * significaria sincronizar dos scrolls y dos alturas.
 *
 * Cada fila dibuja medio carril arriba y medio abajo del nodo: lo que entra
 * curva hacia el nodo, lo que sale curva desde el, y lo que no lo toca lo cruza
 * derecho. Un padre fuera de la pagina sale por abajo sin nodo, que es como se
 * ve "esto sigue".
 */
export function CommitGraph({ rows, laneCount, selectedHash, onSelect }: CommitGraphProps): React.ReactElement {
  const width = LEFT_PAD * 2 + Math.max(laneCount - 1, 0) * LANE_W;
  const height = rows.length * ROW_H;

  return (
    <div className="flex">
      <svg width={width} height={height} className="shrink-0" aria-hidden="true">
        {rows.map((row, index) => {
          const top = index * ROW_H;
          const mid = top + ROW_H / 2;
          const bottom = top + ROW_H;
          const x = laneX(row.lane);
          return (
            <g key={row.commit.hash}>
              {/* Carriles ajenos: cruzan la fila entera sin tocar el nodo. */}
              {row.passingTop.map((lane) => (
                <line key={`pt-${lane}`} x1={laneX(lane)} y1={top} x2={laneX(lane)} y2={mid}
                  stroke={laneColor(lane)} strokeWidth={2} />
              ))}
              {row.passingBottom.map((lane) => (
                <line key={`pb-${lane}`} x1={laneX(lane)} y1={mid} x2={laneX(lane)} y2={bottom}
                  stroke={laneColor(lane)} strokeWidth={2} />
              ))}

              {/* Lo que entraba desde arriba converge en el nodo. */}
              {row.incoming.map((lane) => (
                <path
                  key={`in-${lane}`}
                  d={lane === row.lane
                    ? `M ${x} ${top} L ${x} ${mid}`
                    : `M ${laneX(lane)} ${top} C ${laneX(lane)} ${mid}, ${x} ${top}, ${x} ${mid}`}
                  stroke={laneColor(lane)} strokeWidth={2} fill="none"
                />
              ))}

              {/* Y lo que sale hacia cada padre. */}
              {row.outgoing.map((edge) => (
                <path
                  key={`out-${edge.parentHash}`}
                  d={edge.lane === row.lane
                    ? `M ${x} ${mid} L ${x} ${bottom}`
                    : `M ${x} ${mid} C ${x} ${bottom}, ${laneX(edge.lane)} ${mid}, ${laneX(edge.lane)} ${bottom}`}
                  stroke={laneColor(edge.lane)} strokeWidth={2} fill="none"
                />
              ))}

              {/* El nodo: relleno si es commit normal, anillo si es merge. */}
              <circle
                cx={x} cy={mid} r={row.commit.hash === selectedHash ? 6 : 4.5}
                fill={row.isMerge ? '#fff' : laneColor(row.lane)}
                stroke={laneColor(row.lane)}
                strokeWidth={row.isMerge ? 2.5 : row.commit.hash === selectedHash ? 2.5 : 0}
              />
            </g>
          );
        })}
      </svg>

      <ul className="min-w-0 flex-1">
        {rows.map((row) => {
          const selected = row.commit.hash === selectedHash;
          return (
            <li key={row.commit.hash} style={{ height: ROW_H }}>
              <button
                type="button"
                onClick={() => onSelect(row.commit.hash)}
                title={row.commit.subject}
                style={{ height: ROW_H }}
                className={`flex w-full items-center gap-2 px-3 text-left text-sm transition ${
                  selected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                {row.commit.refs.map((r) => <RefChip key={`${r.type}-${r.name}`} refItem={r} />)}
                <span className={`min-w-0 flex-1 truncate ${selected ? 'font-medium text-indigo-900' : 'text-slate-700'}`}>
                  {row.commit.subject}
                </span>
                <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{row.commit.author_name}</span>
                <span className="shrink-0 font-mono text-xs text-slate-400">{row.commit.hash.slice(0, 7)}</span>
                <span className="hidden shrink-0 text-xs text-slate-400 md:inline">{timeAgo(row.commit.date)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
