import React, { useState } from 'react';
import { runModuleTool } from '../../lib/catalog-api.js';
import type { CatalogModuleTool } from '../../lib/catalog-api.js';
import type { ModuleViewProps } from '../registry.js';
import { StatusBadge } from '../../components/ui/atoms/StatusBadge.js';

const INPUT_CLASS =
  'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400';

const EXTRACTO_EJEMPLO = `[
  { "concepto": "Alquiler", "monto": 1200 },
  { "concepto": "Proveedor A", "monto": 340.5 },
  { "concepto": "Comisión banco", "monto": 15 }
]`;

const LIBRO_EJEMPLO = `[
  { "concepto": "Alquiler", "monto": 1200 },
  { "concepto": "Proveedor A", "monto": 340.5 }
]`;

/**
 * Área de trabajo del módulo `demo-conciliacion`.
 *
 * Es el EJEMPLO que valida la estructura de punta a punta: el módulo se declara
 * en el código (`BUILT_MODULES`), el sync lo trae a la base, el superadmin lo
 * mete en un paquete y se lo asigna a un proyecto, el sidebar lo ancla, y acá se
 * resuelve y se ejecuta su herramienta contra la tool real.
 *
 * Deliberadamente feo y directo: dos textareas con JSON. Lo que se prueba es la
 * cadena, no la UX de una conciliación de verdad — cuando haya un módulo real,
 * esto se borra.
 */
export function View({ projectId, module }: ModuleViewProps): React.ReactElement {
  const [extracto, setExtracto] = useState(EXTRACTO_EJEMPLO);
  const [libro, setLibro] = useState(LIBRO_EJEMPLO);
  const [salida, setSalida] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [corriendo, setCorriendo] = useState<string | null>(null);

  // La herramienta se busca por su `key` del código y no por el nombre visible: el
  // nombre lo puede cambiar el superadmin desde la pantalla de catálogo, y el
  // módulo dejaría de encontrar lo que ejecuta.
  const conciliar = module.module_tools.find((u) => u.key === 'demo-conciliar-movimientos') ?? null;
  const exportar = module.module_tools.find((u) => u.key === 'demo-exportar-csv') ?? null;

  async function ejecutar(herramienta: CatalogModuleTool, input: Record<string, unknown>): Promise<void> {
    setCorriendo(herramienta.id);
    setError(null);
    try {
      setSalida(await runModuleTool(projectId, herramienta.id, input));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar la herramienta');
      setSalida(null);
    } finally {
      setCorriendo(null);
    }
  }

  function parsear(texto: string, campo: string): unknown {
    try {
      return JSON.parse(texto);
    } catch {
      throw new Error(`${campo} no es JSON válido`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Extracto</label>
          <textarea rows={8} value={extracto} onChange={(e) => setExtracto(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Libro</label>
          <textarea rows={8} value={libro} onChange={(e) => setLibro(e.target.value)} className={INPUT_CLASS} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!conciliar || corriendo !== null}
          onClick={() => {
            setError(null);
            try {
              const input = { extracto: parsear(extracto, 'Extracto'), libro: parsear(libro, 'Libro') };
              if (conciliar) void ejecutar(conciliar, input);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Entrada inválida');
            }
          }}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {corriendo && conciliar && corriendo === conciliar.id ? 'Conciliando…' : 'Conciliar'}
        </button>

        <button
          type="button"
          // La herramienta ABIERTA: no sabe nada de conciliación, exporta lo que
          // haya a la vista. Es la mitad del ejemplo que prueba que una herramienta
          // sirve en cualquier módulo que acepte abiertas.
          disabled={!exportar || corriendo !== null || salida === null}
          onClick={() => {
            const filas = Array.isArray(salida) ? salida : [salida as Record<string, unknown>];
            if (exportar) void ejecutar(exportar, { filas });
          }}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40"
        >
          Exportar a CSV
        </button>

        {!conciliar && <StatusBadge label="la herramienta de conciliar no está en este módulo" tone="warning" />}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {salida !== null && (
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Resultado</h3>
          <pre className="max-h-72 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-200">
            {typeof salida === 'string' ? salida : JSON.stringify(salida, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
