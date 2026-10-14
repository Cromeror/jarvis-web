import React from 'react';
import { Tabla, type ColumnaDeTabla } from '../Tabla.js';
import { Badge, type BadgeStatus } from '../atoms/Badge.js';

export interface RecentPipelinesTable2Row {
  id: string;
  name: string;
  project: string;
  statusLabel: string;
  statusTone: BadgeStatus;
  duration: string;
}

interface RecentPipelinesTable2Props {
  rows: RecentPipelinesTable2Row[];
}

const COLUMNAS: ColumnaDeTabla[] = [
  { id: 'name', label: 'Pipeline', w: 200, elastica: true, tip: true },
  { id: 'project', label: 'Proyecto', w: 140, tip: true },
  { id: 'status', label: 'Estado', w: 110, dato: 'statusLabel' },
  { id: 'duration', label: 'Duración', w: 100, al: 'der', orden: false },
];

/**
 * RecentPipelinesTable2 — las últimas corridas de pipelines, sobre la `Tabla`
 * del template. A diferencia de la tabla genérica, SÍ conoce el dominio
 * (pipeline + proyecto + estado + duración): es la forma que tiene esta
 * sección del Dashboard, no una tabla configurable.
 *
 * El proyecto pasó a su propia columna: antes iba como segundo renglón dentro
 * de la celda del pipeline, que en la tabla del sistema —una fila, una línea—
 * no tiene lugar sin romper el alto de fila de todas las demás.
 */
export function RecentPipelinesTable2({ rows }: RecentPipelinesTable2Props): React.ReactElement {
  return (
    <Tabla<RecentPipelinesTable2Row>
      titulo="Pipelines recientes"
      columnas={COLUMNAS}
      filas={rows}
      clave={(r) => r.id}
      nombreFila={(r) => r.name}
      seleccion={false}
      celda={(r, c) => {
        if (c.id === 'status') return <Badge label={r.statusLabel} status={r.statusTone} />;
        return String(r[c.id as keyof RecentPipelinesTable2Row] ?? '');
      }}
      textos={{ vacio: 'Todavía no hay corridas de pipelines', rangoVacio: 'Sin corridas' }}
    />
  );
}
