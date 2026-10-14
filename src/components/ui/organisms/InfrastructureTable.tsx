import React from 'react';
import { Tabla, type ColumnaDeTabla } from '../Tabla.js';
import { ReplicaIndicator } from '../molecules/ReplicaIndicator.js';
import { EnvTag } from '../molecules/EnvTag.js';

export interface InfrastructureTableEnv {
  name: string;
  active: boolean;
}

export interface InfrastructureTableRow {
  id: string;
  project: string;
  activeReplicas: number;
  totalReplicas: number;
  environments: InfrastructureTableEnv[];
}

interface InfrastructureTableProps {
  rows: InfrastructureTableRow[];
}

const COLUMNAS: ColumnaDeTabla[] = [
  { id: 'project', label: 'Proyecto', w: 160, elastica: true, tip: true },
  {
    id: 'replicas',
    label: 'Réplicas',
    w: 110,
    valor: (f: InfrastructureTableRow) => f.activeReplicas,
  } as ColumnaDeTabla,
  { id: 'environments', label: 'Ambientes', w: 220, al: 'der', orden: false },
];

/**
 * InfrastructureTable — réplicas y ambientes por proyecto, sobre la `Tabla`
 * del template. Antes era una tabla a mano con su propio skin (`--table2-*`),
 * que además no estaba definido; con la del sistema hereda el orden por
 * columna, el filete y el vacío, y se ve igual que cualquier otra tabla de la
 * app. Sin casillas ni menú de fila: acá no hay nada que hacerle a un proyecto.
 */
export function InfrastructureTable({ rows }: InfrastructureTableProps): React.ReactElement {
  return (
    <Tabla<InfrastructureTableRow>
      titulo="Infraestructura"
      columnas={COLUMNAS}
      filas={rows}
      clave={(r) => r.id}
      nombreFila={(r) => r.project}
      seleccion={false}
      textoDeCelda={(r, c) => (c.id === 'project' ? r.project : '')}
      celda={(r, c) => {
        if (c.id === 'replicas') return <ReplicaIndicator active={r.activeReplicas} total={r.totalReplicas} />;
        if (c.id === 'environments') {
          return (
            <span className="inline-flex flex-wrap justify-end gap-1.5">
              {r.environments.map((env) => (
                <EnvTag key={env.name} label={env.name} active={env.active} />
              ))}
            </span>
          );
        }
        return r.project;
      }}
      textos={{ vacio: 'No hay proyectos para mostrar', rangoVacio: 'Sin proyectos' }}
    />
  );
}
