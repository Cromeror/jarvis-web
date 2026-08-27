import React from 'react';
import { ROOT_REPLICA, type ProjectReplica } from '../../../lib/project-replicas-api.js';

interface ReplicaChoiceListProps {
  /** Solo réplicas usables — filtrar por `status === 'active'` antes de pasarlas. */
  replicas: ProjectReplica[];
  /** `ROOT_REPLICA` o el id de una réplica. Nunca `null`: ver el sentinel. */
  value: string;
  onChange: (value: string) => void;
  /** Qué significa "el proyecto" en este contexto — difiere entre lanzar un plan y mover un chat. */
  rootHint: string;
  /** Marca la opción que la conversación/corrida ya está usando, si aplica. */
  currentValue?: string;
}

/**
 * "¿Contra qué working tree?" — la elección base + réplicas, una sola vez.
 *
 * La comparten elegir dónde corre un plan (PlanLaunchDialog) y mover una
 * conversación a otro workspace (SessionWorkspaceDialog). Son dos preguntas
 * distintas sobre el mismo conjunto de opciones, y duplicarla significaba que
 * el sentinel de la base se implementara dos veces — justo el detalle que ya
 * tiene una nota entera explicando por qué no puede ser `null`.
 */
export function ReplicaChoiceList({
  replicas,
  value,
  onChange,
  rootHint,
  currentValue,
}: ReplicaChoiceListProps): React.ReactElement {
  const options = [
    { key: ROOT_REPLICA, title: 'El proyecto', hint: rootHint },
    ...replicas.map((r) => ({ key: r.id, title: r.slug, hint: r.branch })),
  ];

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <label
          key={option.key}
          className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
        >
          <input
            type="radio"
            className="mt-1"
            checked={value === option.key}
            onChange={() => onChange(option.key)}
          />
          <span className="text-sm">
            <span className="font-medium text-slate-900">{option.title}</span>
            {currentValue === option.key && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                actual
              </span>
            )}
            <span className="block text-slate-500">{option.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
