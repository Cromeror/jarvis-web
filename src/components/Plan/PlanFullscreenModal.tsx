import React, { useEffect, useRef, useState } from 'react';
import { diffWords } from 'diff';
import {
  getPlan,
  updatePlan,
  approvePlan,
  launchPlan,
  listPlanAnnotations,
  createPlanAnnotation,
  deletePlanAnnotation,
  sendPlanAnnotations,
  resolvePlanAnnotation,
  reopenPlanAnnotation,
} from '../../lib/plans-api.js';
import type { PlanDetail, PlanAnnotation, PlanAnnotationAnchorKind } from '../../lib/plans-api.js';
import { PlanMarkdown } from './PlanMarkdown.js';
import { PlanLaunchDialog } from './PlanLaunchDialog.js';
import { Toast, useToast } from '../ui/atoms/Toast.js';

interface PlanFullscreenModalProps {
  planId: string;
  onClose: () => void;
  /** Chat session currently open, if any — "enviar al chat" only applies when it matches plan.session_id. */
  activeSessionId: string | null;
  /** Forwards a composed message into the open chat, as if the user had typed it. */
  onSendToChat?: (message: string) => void;
  /** Called with the run id once the plan is launched, so the caller can navigate to the progress view. */
  onLaunched?: (runId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  running: 'Ejecutando',
  done: 'Completado',
  failed: 'Falló',
  archived: 'Archivado',
};

interface SelectionPopover {
  anchorKind: PlanAnnotationAnchorKind;
  stepId: string | null;
  quote: string;
  rangeStart: number;
  rangeEnd: number;
  x: number;
  y: number;
}

/** Walks up from a selection endpoint to the nearest ancestor carrying `data-anchor-kind` — the selectable block (Contexto/Arquitectura/un paso) that owns it. */
function findAnchorEl(node: Node | null): HTMLElement | null {
  let el: Node | null = node;
  while (el) {
    if (el instanceof HTMLElement && el.dataset.anchorKind) return el;
    el = el.parentNode;
  }
  return null;
}

/** Best-effort character offsets of `range` within `container`'s plain text — only used for potential future re-anchoring, not for diffing (diffing always compares full-block snapshots). */
function computeOffsets(container: HTMLElement, range: Range): { start: number; end: number } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let start = 0;
  let end = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (node === range.startContainer) start = offset + range.startOffset;
    if (node === range.endContainer) end = offset + range.endOffset;
    offset += len;
  }
  return { start, end };
}

function anchorLabel(kind: PlanAnnotationAnchorKind, stepId: string | null): string {
  if (kind === 'context') return 'Contexto';
  if (kind === 'architecture') return 'Arquitectura';
  return `Paso ${stepId ?? ''}`;
}

function AnnotationDiff({ before, after }: { before: string; after: string }): React.ReactElement {
  if (before === after) {
    return <p className="text-xs italic text-slate-400">Todavía no se reflejó ningún cambio en el plan.</p>;
  }
  const parts = diffWords(before, after);
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-xs leading-relaxed">
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            part.added
              ? 'bg-emerald-100 text-emerald-800'
              : part.removed
              ? 'text-red-700 line-through bg-red-100'
              : 'text-slate-600'
          }
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}

/**
 * Vista de lectura del plan a (casi) pantalla completa. Permite seleccionar
 * texto dentro de Contexto/Arquitectura/la descripción de un paso y dejar una
 * anotación (comentario/pedido de cambio). Las anotaciones se acumulan en una
 * pila lateral; el usuario elige cuáles están "terminadas" y las manda al chat
 * abierto (si el plan pertenece a esa conversación) para que el modelo aplique
 * los cambios con `plan_update`. Una vez aplicados, se ve el diff contra el
 * contenido vivo del bloque y se puede marcar la anotación como resuelta.
 */
export function PlanFullscreenModal({ planId, onClose, activeSessionId, onSendToChat, onLaunched }: PlanFullscreenModalProps): React.ReactElement {
  const { toasts, addToast, removeToast } = useToast();
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [annotations, setAnnotations] = useState<PlanAnnotation[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [popover, setPopover] = useState<SelectionPopover | null>(null);
  const [composing, setComposing] = useState(false);
  const [draftComment, setDraftComment] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Vincula el plan a la conversación que ya está abierta — no hace falta
  // elegir de una lista: si está abierta, es la que cumple la condición de
  // canSendToChat en cuanto se guarda. El server valida que sea del mismo
  // proyecto del plan (PATCH /api/plans/:id), así que un mismatch se resuelve
  // con el error que devuelve, no con un chequeo duplicado acá.
  const [reassigning, setReassigning] = useState(false);
  /** Diálogo "¿dónde corre?" abierto — el launch pasa por ahí para poder elegir réplica. */
  const [askingWhere, setAskingWhere] = useState(false);

  async function refresh(): Promise<void> {
    const [d, a] = await Promise.all([getPlan(planId), listPlanAnnotations(planId)]);
    setDetail(d);
    setAnnotations(a);
  }

  async function handleLinkActiveSession(): Promise<void> {
    if (!activeSessionId) return;
    setReassigning(true);
    try {
      await updatePlan(planId, { session_id: activeSessionId });
      await refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al vincular la conversación', 'error');
    } finally {
      setReassigning(false);
    }
  }

  async function handleApprove(): Promise<void> {
    setBusy(true);
    try {
      await approvePlan(planId);
      await refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al aprobar el plan', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunch(replicaId?: string): Promise<void> {
    setBusy(true);
    setAskingWhere(false);
    try {
      if (detail?.plan.status === 'draft') await approvePlan(planId);
      const { run_id } = await launchPlan(planId, replicaId);
      await refresh();
      onLaunched?.(run_id);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al lanzar el plan', 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getPlan(planId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err: unknown) => addToast(err instanceof Error ? err.message : 'Error al cargar el plan', 'error'));
    listPlanAnnotations(planId)
      .then((a) => { if (!cancelled) setAnnotations(a); })
      .catch((err: unknown) => addToast(err instanceof Error ? err.message : 'Error al cargar anotaciones', 'error'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  function handleMouseUp(): void {
    const sel = window.getSelection();
    const quote = sel && !sel.isCollapsed ? sel.toString().trim() : '';
    if (!quote) {
      // La selección se vació (click suelto, deselección) — no dejar el popover viejo flotando.
      setPopover(null);
      setComposing(false);
      return;
    }
    const range = sel!.getRangeAt(0);
    const startEl = findAnchorEl(range.startContainer);
    const endEl = findAnchorEl(range.endContainer);
    if (!startEl || !endEl || startEl !== endEl) {
      if (startEl && endEl) addToast('Seleccioná texto dentro de un solo bloque (Contexto, Arquitectura o un paso)', 'info');
      return;
    }
    const anchorKind = startEl.dataset.anchorKind as PlanAnnotationAnchorKind;
    const stepId = startEl.dataset.anchorStepId ?? null;
    const { start, end } = computeOffsets(startEl, range);
    const rect = range.getBoundingClientRect();
    setPopover({ anchorKind, stepId, quote, rangeStart: start, rangeEnd: end, x: rect.left, y: rect.top });
    setComposing(false);
    setDraftComment('');
  }

  async function handleCreateAnnotation(): Promise<void> {
    if (!popover || !draftComment.trim()) return;
    setBusy(true);
    try {
      const annotation = await createPlanAnnotation(planId, {
        anchor_kind: popover.anchorKind,
        step_id: popover.stepId,
        quote: popover.quote,
        range_start: popover.rangeStart,
        range_end: popover.rangeEnd,
        comment: draftComment.trim(),
      });
      setAnnotations((prev) => [...prev, annotation]);
      setPopover(null);
      setComposing(false);
      setDraftComment('');
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al crear la anotación', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(annotationId: string): Promise<void> {
    try {
      await deletePlanAnnotation(planId, annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(annotationId); return next; });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al borrar la anotación', 'error');
    }
  }

  function toggleSelected(annotationId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(annotationId)) next.delete(annotationId);
      else next.add(annotationId);
      return next;
    });
  }

  const canSendToChat = Boolean(activeSessionId && detail?.plan.session_id === activeSessionId && onSendToChat);

  async function handleSendSelected(): Promise<void> {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBusy(true);
    try {
      const { annotations: updated, message } = await sendPlanAnnotations(planId, ids);
      setAnnotations((prev) => prev.map((a) => updated.find((u) => u.id === a.id) ?? a));
      setSelectedIds(new Set());
      onSendToChat?.(message);
      addToast('Anotaciones enviadas al chat', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al enviar las anotaciones', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(annotationId: string): Promise<void> {
    try {
      const annotation = await resolvePlanAnnotation(planId, annotationId);
      setAnnotations((prev) => prev.map((a) => (a.id === annotationId ? annotation : a)));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al resolver la anotación', 'error');
    }
  }

  async function handleReopen(annotationId: string): Promise<void> {
    try {
      const annotation = await reopenPlanAnnotation(planId, annotationId);
      setAnnotations((prev) => prev.map((a) => (a.id === annotationId ? annotation : a)));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al reabrir la anotación', 'error');
    }
  }

  function currentAnchorContent(a: PlanAnnotation): string | null {
    if (!detail) return null;
    if (a.anchor_kind === 'context') return detail.plan.context;
    if (a.anchor_kind === 'architecture') return detail.plan.architecture;
    return detail.steps.find((s) => s.step_id === a.step_id)?.description ?? null;
  }

  const pending = annotations.filter((a) => a.status === 'pending');
  const sent = annotations.filter((a) => a.status === 'sent');
  const resolved = annotations.filter((a) => a.status === 'resolved');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Toast toasts={toasts} onDismiss={removeToast} />
      <div className="flex h-[94vh] w-[96vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{detail?.plan.title ?? 'Plan'}</h2>
            {detail && (
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {STATUS_LABEL[detail.plan.status] ?? detail.plan.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {detail?.plan.status === 'draft' && (
              <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={busy}
                className="rounded-full border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
              >
                Aprobar
              </button>
            )}
            {(detail?.plan.status === 'draft' || detail?.plan.status === 'approved') && (
              <button
                type="button"
                onClick={() => setAskingWhere(true)}
                disabled={busy}
                className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Lanzar ahora
              </button>
            )}
            {detail?.plan.status === 'running' && (
              <span className="text-xs text-slate-500">Ejecutándose…</span>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              title="Actualizar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <i className="pi pi-refresh text-sm" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <i className="pi pi-times text-sm" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            ref={contentRef}
            onMouseUp={handleMouseUp}
            className="flex-1 overflow-y-auto px-8 py-6"
          >
            {!detail && <div className="text-sm text-slate-400">Cargando plan…</div>}
            {detail && (
              <div className="mx-auto max-w-3xl space-y-6">
                <div data-anchor-kind="context">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Contexto</div>
                  <PlanMarkdown className="mt-1">{detail.plan.context}</PlanMarkdown>
                </div>
                <div data-anchor-kind="architecture">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Arquitectura</div>
                  <PlanMarkdown className="mt-1">{detail.plan.architecture}</PlanMarkdown>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Pasos ({detail.steps.length})
                  </div>
                  <ol className="space-y-2">
                    {[...detail.steps]
                      .sort((a, b) => a.step_index - b.step_index)
                      .map((step) => (
                        <li key={step.step_id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500">{step.step_id}</span>
                            {step.tool_name && <span className="font-mono text-indigo-600">{step.tool_name}</span>}
                          </div>
                          <div data-anchor-kind="step" data-anchor-step-id={step.step_id} className="mt-1">
                            <PlanMarkdown className={step.kind === 'turn' ? 'italic text-slate-500' : 'text-slate-700'}>
                              {step.description}
                            </PlanMarkdown>
                          </div>
                          {step.dependsOn.length > 0 && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              {/* Sin esto un remediador se ve idéntico a un paso normal, y la
                                  diferencia es justamente cuándo corre. Sólo se muestra lo que
                                  NO es el default: marcar "on_success" en cada paso sería ruido. */}
                              {step.run_if === 'on_failure'
                                ? 'corre si falla: '
                                : step.run_if === 'always'
                                  ? 'corre siempre, después de: '
                                  : 'depende de: '}
                              {step.dependsOn.join(', ')}
                            </p>
                          )}
                        </li>
                      ))}
                  </ol>
                </div>
              </div>
            )}
          </div>

          <div className="w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50 px-4 py-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Anotaciones</h3>
              {pending.length > 0 && (
                <button
                  type="button"
                  disabled={!canSendToChat || selectedIds.size === 0 || busy}
                  onClick={() => void handleSendSelected()}
                  title={canSendToChat ? 'Enviar las anotaciones seleccionadas al chat' : 'Abrí la conversación de este plan para poder enviar anotaciones'}
                  className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Enviar al chat ({selectedIds.size})
                </button>
              )}
            </div>

            {!canSendToChat && pending.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-[11px] text-amber-700">
                  Esta anotación no tiene la conversación del plan abierta — no se puede enviar al chat todavía.
                </p>
                {activeSessionId ? (
                  <button
                    type="button"
                    disabled={reassigning}
                    onClick={() => void handleLinkActiveSession()}
                    className="mt-1.5 text-[11px] font-medium text-amber-800 underline hover:text-amber-900 disabled:opacity-40"
                  >
                    Vincular esta conversación al plan
                  </button>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Abrí una conversación de este proyecto para poder vincularla.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              {pending.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Pendientes ({pending.length})</div>
                  <ul className="space-y-2">
                    {pending.map((a) => (
                      <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={selectedIds.has(a.id)}
                            onChange={() => toggleSelected(a.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{anchorLabel(a.anchor_kind, a.step_id)}</div>
                            <p className="mt-0.5 italic text-slate-500">"{a.quote}"</p>
                            <p className="mt-1 text-slate-700">{a.comment}</p>
                          </div>
                          <button type="button" onClick={() => void handleDelete(a.id)} title="Borrar" className="text-slate-300 hover:text-red-500">
                            <i className="pi pi-trash text-[11px]" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sent.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Enviadas ({sent.length})</div>
                  <ul className="space-y-2">
                    {sent.map((a) => {
                      const current = currentAnchorContent(a);
                      return (
                        <li key={a.id} className="rounded-lg border border-indigo-200 bg-white p-2.5 text-xs">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{anchorLabel(a.anchor_kind, a.step_id)}</div>
                          <p className="mt-0.5 italic text-slate-500">"{a.quote}"</p>
                          <p className="mt-1 text-slate-700">{a.comment}</p>
                          {a.snapshot_before !== null && current !== null && (
                            <div className="mt-2">
                              <AnnotationDiff before={a.snapshot_before} after={current} />
                            </div>
                          )}
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleResolve(a.id)}
                              className="rounded-full border border-emerald-300 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              ✓ Resuelto
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {resolved.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Resueltas ({resolved.length})</div>
                  <ul className="space-y-2">
                    {resolved.map((a) => (
                      <li key={a.id} className="rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-xs opacity-70">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{anchorLabel(a.anchor_kind, a.step_id)}</div>
                            <p className="mt-0.5 italic text-slate-500">"{a.quote}"</p>
                            <p className="mt-1 text-slate-600">{a.comment}</p>
                          </div>
                          <button type="button" onClick={() => void handleReopen(a.id)} className="shrink-0 text-[11px] text-slate-400 underline hover:text-slate-600">
                            Reabrir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {annotations.length === 0 && (
                <p className="text-xs text-slate-400">Seleccioná texto del plan para dejar una anotación.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {askingWhere && detail && (
        <PlanLaunchDialog
          planTitle={detail.plan.title}
          projectId={detail.plan.project_id}
          onCancel={() => setAskingWhere(false)}
          onConfirm={(replicaId) => void handleLaunch(replicaId)}
        />
      )}

      {popover && (
        <div
          className="fixed z-[60] -translate-y-full"
          style={{ left: popover.x, top: popover.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!composing ? (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-slate-700"
            >
              + Comentar
            </button>
          ) : (
            <div className="w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <p className="mb-2 truncate text-[11px] italic text-slate-400">"{popover.quote}"</p>
              <textarea
                autoFocus
                rows={3}
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                placeholder="Comentario, pedido de cambio, mejora…"
                className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setPopover(null); setComposing(false); setDraftComment(''); }}
                  className="rounded-full px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!draftComment.trim() || busy}
                  onClick={() => void handleCreateAnnotation()}
                  className="rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
