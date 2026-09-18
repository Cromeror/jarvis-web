import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleViewProps } from '../registry.js';
import {
  AccountingApiError,
  downloadUrl,
  fetchLimits,
  leerBase64,
  listDocuments,
  uploadDocument,
  type AccountingDocument,
} from '../../lib/accounting-documents-api.js';
import { DataTable, type DataTableColumn } from '../../components/ui/organisms/DataTable.js';
import { Button2 } from '../../components/ui/atoms/Button2.js';
import { StatusBadge } from '../../components/ui/atoms/StatusBadge.js';
import { COLUMNAS } from './columnas.js';

/**
 * Área de trabajo de `causacion-facturas`: el repositorio de soportes.
 *
 * Esta primera vuelta es deliberadamente chica — subir y listar — porque es lo
 * que hace falta para que el módulo sirva desde el día uno y para validar las
 * reglas que sí están completas: la whitelist por firma de bytes, el rechazo de
 * duplicados por contenido y el audit log. Mover, copiar y el árbol de carpetas
 * ya tienen endpoint y tool; les falta sólo la UI.
 *
 * La tabla trae las 24 columnas del extractor aunque hoy la mayoría venga
 * vacía. Es a propósito: el procesamiento todavía no existe, y una tabla que
 * crece de 5 a 24 columnas cuando llegue obligaría a rehacer el layout. Las
 * columnas vacías muestran qué falta; las llenas, qué ya se sabe.
 */

const ESTADO_TONE: Record<AccountingDocument['procesamiento_estado'], 'neutral' | 'success' | 'danger'> = {
  pendiente: 'neutral',
  listo: 'success',
  fallo: 'danger',
};

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Rechazo {
  filename: string;
  motivo: string;
}

export function View({ projectId }: ModuleViewProps): React.ReactElement {
  const [documentos, setDocumentos] = useState<AccountingDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazos, setRechazos] = useState<Rechazo[]>([]);
  const [extensiones, setExtensiones] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const { documentos: docs, total: t } = await listDocuments(projectId, { limit: 200 });
      setDocumentos(docs);
      setTotal(t);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los documentos');
    } finally {
      setCargando(false);
    }
  }, [projectId]);

  useEffect(() => {
    void recargar();
    // Los formatos aceptados los decide el SERVIDOR; se piden en vez de
    // escribirlos acá para que el `accept` del input no se desincronice de lo
    // que la validación realmente permite.
    void fetchLimits(projectId)
      .then((l) => setExtensiones(l.extensiones))
      .catch(() => setExtensiones([]));
  }, [projectId, recargar]);

  /**
   * Se sube archivo por archivo y los rechazos se acumulan, no cortan.
   *
   * Es lo contrario a los adjuntos del chat (todo o nada por turno) y por una
   * razón concreta: acá cada documento es independiente, y que una factura de
   * veinte sea un formato no soportado no es motivo para descartar las otras
   * diecinueve que la persona ya seleccionó.
   */
  async function subir(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    setError(null);
    const fallidos: Rechazo[] = [];

    for (const file of Array.from(files)) {
      try {
        const content_base64 = await leerBase64(file);
        await uploadDocument(projectId, { filename: file.name, content_base64 });
      } catch (err) {
        const motivo =
          err instanceof AccountingApiError || err instanceof Error
            ? err.message
            : 'no se pudo subir';
        fallidos.push({ filename: file.name, motivo });
      }
    }

    setRechazos(fallidos);
    setSubiendo(false);
    // Se recarga aunque haya fallidos: los que sí entraron tienen que verse.
    await recargar();
    if (inputRef.current) inputRef.current.value = '';
  }

  const columnas: Array<DataTableColumn<AccountingDocument>> = useMemo(
    () => [
      ...COLUMNAS.map((col) => ({
        key: col.key,
        header: col.header,
        className: col.numerica ? 'text-right tabular-nums whitespace-nowrap' : 'whitespace-nowrap',
        render: (doc: AccountingDocument): React.ReactNode => {
          const valor = col.leer(doc);
          if (!valor) return <span className="text-[var(--card-text-secondary)] opacity-40">—</span>;
          if (col.key === 'archivo') {
            return (
              <a
                href={downloadUrl(projectId, doc.id)}
                className="font-medium underline decoration-dotted underline-offset-2"
                title={`${doc.kind} · ${formatearTamano(doc.size_bytes)}`}
              >
                {valor}
              </a>
            );
          }
          // Las columnas largas del extractor (observaciones, descripción)
          // arruinan la tabla si se dejan crecer: se cortan y el texto completo
          // queda en el title.
          return (
            <span className="block max-w-[28ch] truncate" title={valor}>
              {valor}
            </span>
          );
        },
      })),
      {
        key: 'procesamiento_estado',
        header: 'Procesamiento',
        className: 'whitespace-nowrap',
        render: (doc) => <StatusBadge label={doc.procesamiento_estado} tone={ESTADO_TONE[doc.procesamiento_estado]} />,
      },
    ],
    [projectId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--card-text-primary)]">Documentos</h2>
          <p className="text-xs text-[var(--card-text-secondary)]">
            {cargando ? 'Cargando…' : `${total} documento${total === 1 ? '' : 's'}`}
            {extensiones.length > 0 && ` · se aceptan ${extensiones.join(', ')}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            // Comodidad, no la puerta: el servidor valida por firma de bytes.
            // Un archivo elegido por «todos los archivos» igual se rechaza allá.
            accept={extensiones.join(',')}
            className="hidden"
            onChange={(e) => void subir(e.target.files)}
          />
          <Button2
            label={subiendo ? 'Subiendo…' : 'Subir documentos'}
            iconLeft={<i className="pi pi-upload text-[12px]" />}
            onClick={() => inputRef.current?.click()}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {rechazos.length > 0 && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-200">
          <p className="font-medium">
            {rechazos.length} archivo{rechazos.length === 1 ? '' : 's'} no se {rechazos.length === 1 ? 'subió' : 'subieron'}:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
            {rechazos.map((r) => (
              <li key={r.filename}>
                <span className="font-medium">{r.filename}</span> — {r.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!cargando && documentos.length === 0 ? (
        <div className="rounded-[var(--table2-radius)] border border-dashed border-[var(--table2-border)] px-4 py-10 text-center">
          <p className="text-sm text-[var(--card-text-secondary)]">
            Todavía no hay documentos. Subí las facturas, remisiones y comprobantes que sustentan las operaciones.
          </p>
        </div>
      ) : (
        // La tabla del extractor es ancha por naturaleza (24 columnas): el
        // scroll horizontal es la respuesta correcta, no esconder columnas.
        <div className="overflow-x-auto">
          <DataTable columns={columnas} rows={documentos} getRowKey={(d) => d.id} stripedRows />
        </div>
      )}
    </div>
  );
}
