import React, { useState } from 'react';
import { useCollapsible } from '../../hooks/useCollapsible.js';
import { RailListPanel } from '../ui/organisms/RailListPanel.js';
import { RailIconButton } from '../ui/molecules/RailIconButton.js';
import { runUtility } from '../../lib/catalog-api.js';
import type { CatalogUtility } from '../../lib/catalog-api.js';

export interface UtilityRunResult {
  utility: CatalogUtility;
  output?: unknown;
  error?: string;
}

/**
 * Las utilidades del módulo, en el rail derecho.
 *
 * Van acá y no como tarjetas en el medio porque no son el trabajo: son las
 * herramientas con las que se hace. Es el mismo lugar —y el mismo componente—
 * que el rail de opciones del chat, a propósito: el usuario ya sabe que a la
 * derecha están las acciones sobre lo que tiene enfrente, y aprender un
 * segundo lugar para lo mismo es costo sin beneficio.
 *
 * Su propio `useCollapsible`, igual que `ChatOptionsRail`: no hay overlay
 * mobile con el que combinarlo y el consumidor no necesita controlarlo.
 */
export function UtilitiesRail({
  projectId,
  utilities,
  onResult,
}: {
  projectId: string;
  utilities: CatalogUtility[];
  /** El resultado se muestra en el área de trabajo, no en el rail: acá no hay lugar para un JSON. */
  onResult: (result: UtilityRunResult) => void;
}): React.ReactElement {
  const [collapsed, toggleCollapsed] = useCollapsible('module-utilities-rail');
  const [corriendo, setCorriendo] = useState<string | null>(null);

  async function ejecutar(utility: CatalogUtility): Promise<void> {
    setCorriendo(utility.id);
    try {
      // Sin input: las utilidades que necesitan datos los piden desde la vista
      // del módulo, que es la que sabe qué datos son. Si una los exige y llega
      // vacía, el error de la propia tool dice qué falta — que es mejor
      // explicación que cualquier cosa que pudiéramos inventar acá.
      onResult({ utility, output: await runUtility(projectId, utility.id, {}) });
    } catch (err) {
      onResult({ utility, error: err instanceof Error ? err.message : 'No se pudo ejecutar' });
    } finally {
      setCorriendo(null);
    }
  }

  return (
    <aside
      className={`relative hidden h-full shrink-0 flex-col rounded-[var(--chatoptionsrail-radius)] bg-gradient-to-b from-[var(--chatoptionsrail-bg-from)] to-[var(--chatoptionsrail-bg-to)] px-[var(--chatoptionsrail-padding-h)] py-[var(--chatoptionsrail-padding-v)] md:flex ${
        collapsed ? 'w-[72px] gap-[var(--chatoptionsrail-collapsed-gap)]' : 'w-[350px] gap-[var(--chatoptionsrail-gap)]'
      }`}
    >
      {collapsed ? (
        <RailIconButton
          icon="list-checks"
          active={false}
          onClick={toggleCollapsed}
          title={`Utilidades (${utilities.length})`}
          badge={utilities.length > 0 ? { count: utilities.length, tone: 'accent' } : undefined}
        />
      ) : (
        <div className="flex min-h-0 w-full flex-1 flex-col gap-[var(--chatoptionsrail-gap)] overflow-y-auto">
          <RailListPanel
            label="Utilidades"
            icon="list-checks"
            onToggle={toggleCollapsed}
            emptyLabel="Este módulo no tiene utilidades configuradas."
            actionLabel="Ejecutar"
            items={utilities.map((u) => ({
              id: u.id,
              title: u.name,
              subtitle: u.description ?? '',
              // Qué la respalda, y si está corriendo. Una utilidad sin tool se
              // muestra igual —se declaró antes que su tool— pero sin acción:
              // no hay nada que ejecutar todavía.
              status: corriendo === u.id ? 'Ejecutando…' : (u.tool_name ?? 'sin tool'),
              canAct: Boolean(u.tool_name) && corriendo === null,
            }))}
            onAction={(id) => {
              const utility = utilities.find((u) => u.id === id);
              if (utility) void ejecutar(utility);
            }}
          />
        </div>
      )}
    </aside>
  );
}
