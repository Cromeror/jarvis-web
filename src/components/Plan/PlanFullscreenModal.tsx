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
import { Button } from '../ui/atoms/Button.js';
import { Icon } from '../Icon.js';
import { ETIQUETA_DE_ESTADO, VARIANTE_DE_ESTADO } from './estado-del-plan.js';

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

interface SelectionPopover {
  anchorKind: PlanAnnotationAnchorKind;
  stepId: string | null;
  quote: string;
  rangeStart: number;
  rangeEnd: number;
  x: number;
  y: number;
  /** Borde inferior de la selección: adonde baja el popover si arriba no entra. */
  yAbajo: number;
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
    return <p className="text-xs italic text-muted-foreground">Todavía no se reflejó ningún cambio en el plan.</p>;
  }
  const parts = diffWords(before, after);
  /* Lo agregado y lo quitado con los tokens de estado; lo quitado además
     tachado, para que no dependa sólo del color. */
  return (
    <div className="rounded-[var(--sw-r-md)] bg-muted p-2 text-xs leading-relaxed">
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            part.added
              ? 'bg-[var(--sw-success-bg)] text-[var(--sw-on-success)]'
              : part.removed
                ? 'bg-[var(--sw-error-bg)] text-[var(--sw-on-error)] line-through'
                : 'text-secondary-foreground'
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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  /** La caja del modal: el popover de comentar se posiciona contra ella (ver `handleMouseUp`). */
  const cajaRef = useRef<HTMLElement | null>(null);
  const empezoEnElFondo = useRef(false);
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
    /* Coordenadas RELATIVAS A LA CAJA, no a la ventana. La caja de un
       `.dialog` está centrada con `transform`, y un elemento con transform es
       el bloque contenedor de sus descendientes `fixed`: un popover `fixed` en
       coordenadas de ventana aparecía corrido justo lo que la caja dista del
       borde. Absoluto dentro de la caja es lo mismo, y no depende de eso. */
    const caja = cajaRef.current?.getBoundingClientRect();
    setPopover({
      anchorKind,
      stepId,
      quote,
      rangeStart: start,
      rangeEnd: end,
      x: rect.left - (caja?.left ?? 0),
      y: rect.top - (caja?.top ?? 0),
      yAbajo: rect.bottom - (caja?.top ?? 0),
    });
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

  // Se abre al montar: quien lo usa lo monta cuando hay un plan elegido.
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  /* Rótulo de sección del panel y del cuerpo: el overline del template. */
  const rotulo = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';
  const tarjeta = 'rounded-[var(--sw-r-md)] border border-border bg-card p-2.5 text-xs';

  /*
   * UN `<dialog class="dialog">` CON EL TEMA, y no `Dialogo`. Se probó, y el
   * componente del sistema está hecho para otra forma de modal:
   *
   * - su encabezado es título y descripción; éste lleva el estado y las
   *   acciones del plan (aprobar, lanzar, refrescar), que en el pie quedarían
   *   lejos del título al que se refieren;
   * - su cuerpo es UNA sección con scroll, tope 90% del alto y alto según el
   *   contenido; éste es de alto fijo y con DOS columnas que se desplazan cada
   *   una por su lado (el plan y la pila de anotaciones);
   * - el popover de comentar tiene que ser hijo de la caja (ver
   *   `handleMouseUp`), y `Dialogo` no deja meter nada fuera de su `<section>`.
   *
   * Lo que sí se toma de `Dialogo` es el comportamiento: va a la capa superior
   * del navegador (antes era un overlay de `z-index` y el diálogo de «¿dónde
   * corre?» se abría debajo), Escape cierra, un clic en el fondo cierra sólo si
   * empieza y termina en el fondo, y el `close` no sube por el árbol de React.
   */
  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-label={detail?.plan.title ?? 'Plan'}
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onMouseDown={(e) => {
        empezoEnElFondo.current = e.target === dialogRef.current;
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (empezoEnElFondo.current && e.target === dialogRef.current) dialogRef.current?.close();
        empezoEnElFondo.current = false;
      }}
    >
      <article
        ref={(el) => {
          cajaRef.current = el;
        }}
        className="overflow-hidden rounded-[var(--sw-r-lg)] border border-border bg-popover text-foreground"
        /* El tema le da a la caja de un diálogo relleno y `gap` entre encabezado,
           cuerpo y pie; acá van en cero porque el encabezado y las dos columnas
           llevan su propio relleno y sus filetes van de canto a canto. En
           `style` porque esas reglas no están en una capa y le ganan a una
           utilidad. */
        style={{
          width: 'min(96vw, calc(100vw - 2rem))',
          maxWidth: 'none',
          height: '94vh',
          maxHeight: '94vh',
          padding: 0,
          gap: 0,
        }}
      >
        {/* Adentro de la caja: afuera quedaría debajo del modal, que está en la capa superior. */}
        <Toast toasts={toasts} onDismiss={removeToast} />
        <header className="flex flex-row items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold text-foreground">{detail?.plan.title ?? 'Plan'}</h2>
            {detail && (
              <span className="badge" data-variant={VARIANTE_DE_ESTADO[detail.plan.status]}>
                {ETIQUETA_DE_ESTADO[detail.plan.status] ?? detail.plan.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {detail?.plan.status === 'draft' && (
              <Button onClick={() => void handleApprove()} disabled={busy} variant="outline">
                Aprobar
              </Button>
            )}
            {(detail?.plan.status === 'draft' || detail?.plan.status === 'approved') && (
              <Button onClick={() => setAskingWhere(true)} disabled={busy} variant="primary">
                Lanzar ahora
              </Button>
            )}
            {detail?.plan.status === 'running' && <span className="text-xs text-muted-foreground">Ejecutándose…</span>}
            <button
              type="button"
              className="btn"
              data-variant="ghost"
              data-size="icon-sm"
              onClick={() => void refresh()}
              title="Actualizar"
              aria-label="Actualizar"
            >
              <Icon name="rehacer" />
            </button>
            <button
              type="button"
              className="btn"
              data-variant="ghost"
              data-size="icon-sm"
              onClick={onClose}
              title="Cerrar"
              aria-label="Cerrar"
            >
              <Icon name="x" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div ref={contentRef} onMouseUp={handleMouseUp} className="flex-1 overflow-y-auto px-8 py-6">
            {!detail && <div className="text-sm text-muted-foreground">Cargando plan…</div>}
            {detail && (
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <div data-anchor-kind="context">
                  <div className={rotulo}>Contexto</div>
                  <PlanMarkdown className="mt-1">{detail.plan.context}</PlanMarkdown>
                </div>
                <div data-anchor-kind="architecture">
                  <div className={rotulo}>Arquitectura</div>
                  <PlanMarkdown className="mt-1">{detail.plan.architecture}</PlanMarkdown>
                </div>
                <div className="flex flex-col gap-2">
                  <div className={rotulo}>Pasos ({detail.steps.length})</div>
                  <ol className="flex flex-col gap-2">
                    {[...detail.steps]
                      .sort((a, b) => a.step_index - b.step_index)
                      .map((step) => (
                        <li
                          key={step.step_id}
                          className="flex flex-col gap-1 rounded-[var(--sw-r-lg)] border border-border bg-card px-4 py-3"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="badge font-mono" data-variant="mute">
                              {step.step_id}
                            </span>
                            {step.tool_name && <span className="font-mono text-primary">{step.tool_name}</span>}
                          </div>
                          <div data-anchor-kind="step" data-anchor-step-id={step.step_id}>
                            <PlanMarkdown className={step.kind === 'turn' ? 'italic' : undefined}>
                              {step.description}
                            </PlanMarkdown>
                          </div>
                          {step.dependsOn.length > 0 && (
                            <p className="text-[11px] text-muted-foreground">
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

          <aside className="flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-muted px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Anotaciones</h3>
              {pending.length > 0 && (
                <Button
                  disabled={!canSendToChat || selectedIds.size === 0 || busy}
                  onClick={() => void handleSendSelected()}
                  title={
                    canSendToChat
                      ? 'Enviar las anotaciones seleccionadas al chat'
                      : 'Abrí la conversación de este plan para poder enviar anotaciones'
                  }
                  variant="primary"
                >
                  Enviar al chat ({selectedIds.size})
                </Button>
              )}
            </div>

            {!canSendToChat && pending.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-[var(--sw-r-md)] bg-[var(--sw-warning-bg)] p-2.5 text-[11px] text-[var(--sw-on-warning)]">
                <p>Esta anotación no tiene la conversación del plan abierta — no se puede enviar al chat todavía.</p>
                {activeSessionId ? (
                  <button
                    type="button"
                    disabled={reassigning}
                    onClick={() => void handleLinkActiveSession()}
                    className="self-start font-medium underline disabled:opacity-40"
                  >
                    Vincular esta conversación al plan
                  </button>
                ) : (
                  <p className="opacity-80">Abrí una conversación de este proyecto para poder vincularla.</p>
                )}
              </div>
            )}

            {pending.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className={rotulo}>Pendientes ({pending.length})</div>
                <ul className="flex flex-col gap-2">
                  {pending.map((a) => (
                    <li key={a.id} className={tarjeta}>
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="input mt-0.5 border-[var(--sw-line-strong)]"
                          checked={selectedIds.has(a.id)}
                          onChange={() => toggleSelected(a.id)}
                          aria-label="Elegir para enviar"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {anchorLabel(a.anchor_kind, a.step_id)}
                          </div>
                          <p className="italic text-muted-foreground">"{a.quote}"</p>
                          <p className="text-foreground">{a.comment}</p>
                        </div>
                        <button
                          type="button"
                          className="btn"
                          data-variant="ghost"
                          data-size="icon-sm"
                          onClick={() => void handleDelete(a.id)}
                          title="Borrar"
                          aria-label="Borrar la anotación"
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sent.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className={rotulo}>Enviadas ({sent.length})</div>
                <ul className="flex flex-col gap-2">
                  {sent.map((a) => {
                    const current = currentAnchorContent(a);
                    return (
                      <li key={a.id} className={`${tarjeta} flex flex-col gap-2 border-[var(--sw-accent-line)]`}>
                        <div className="flex flex-col gap-0.5">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {anchorLabel(a.anchor_kind, a.step_id)}
                          </div>
                          <p className="italic text-muted-foreground">"{a.quote}"</p>
                          <p className="text-foreground">{a.comment}</p>
                        </div>
                        {a.snapshot_before !== null && current !== null && (
                          <AnnotationDiff before={a.snapshot_before} after={current} />
                        )}
                        <div className="flex justify-end">
                          <Button variant="outline" onClick={() => void handleResolve(a.id)}>
                            <Icon name="check" /> Resuelto
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {resolved.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className={rotulo}>Resueltas ({resolved.length})</div>
                <ul className="flex flex-col gap-2">
                  {resolved.map((a) => (
                    <li key={a.id} className={`${tarjeta} opacity-70`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {anchorLabel(a.anchor_kind, a.step_id)}
                          </div>
                          <p className="italic text-muted-foreground">"{a.quote}"</p>
                          <p className="text-secondary-foreground">{a.comment}</p>
                        </div>
                        <Button variant="link" className="shrink-0" onClick={() => void handleReopen(a.id)}>
                          Reabrir
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {annotations.length === 0 && (
              <p className="text-xs text-muted-foreground">Seleccioná texto del plan para dejar una anotación.</p>
            )}
          </aside>
        </div>

        {popover && (
          /* Arriba de la selección, como siempre; abajo si arriba no entra.
             La caja recorta lo que se sale (`overflow-hidden`), y la ventana no
             lo hacía: sin esto, comentar la primera línea del Contexto dejaba
             el textarea cortado bajo el borde. 180px es el alto del popover
             abierto. */
          <div
            className={`absolute z-10 ${popover.y > 180 ? '-translate-y-full' : ''}`}
            style={{ left: popover.x, top: popover.y > 180 ? popover.y : popover.yAbajo + 4 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {!composing ? (
              <Button onClick={() => setComposing(true)} variant="primary" className="shadow-lg">
                + Comentar
              </Button>
            ) : (
              <div className="flex w-72 flex-col gap-2 rounded-[var(--sw-r-lg)] border border-border bg-popover p-3 shadow-[var(--sw-e-pop)]">
                <p className="truncate text-[11px] italic text-muted-foreground">"{popover.quote}"</p>
                <textarea
                  autoFocus
                  rows={3}
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                  placeholder="Comentario, pedido de cambio, mejora…"
                  className="textarea resize-none text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPopover(null);
                      setComposing(false);
                      setDraftComment('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={!draftComment.trim() || busy}
                    onClick={() => void handleCreateAnnotation()}
                    variant="primary"
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Adentro de la caja y no como hermano: Basecoat estila como caja a
            TODO hijo directo de `.dialog`, y el `<dialog>` de este diálogo lo
            es. Que quede dentro de un elemento con transform no lo afecta: va
            a la capa superior, que se posiciona contra la ventana. */}
        {askingWhere && detail && (
          <PlanLaunchDialog
            planTitle={detail.plan.title}
            projectId={detail.plan.project_id}
            onCancel={() => setAskingWhere(false)}
            onConfirm={(replicaId) => void handleLaunch(replicaId)}
          />
        )}
      </article>

    </dialog>
  );
}
