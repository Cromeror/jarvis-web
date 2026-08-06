import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../chat-api.js';
import {
  applyCancelledMessage,
  summarizeBackgroundTasks,
  type QueuedCommandLike,
  type BackgroundTaskLike,
  type BackgroundSummary as BackgroundSummaryLike,
} from '../chat-queue.js';

/**
 * Las dos mitades del contrato que sostiene el diseño, ambas verificadas contra
 * el CLI real 2.1.220:
 *
 * 1. `cancel_async_message` — saca un mensaje encolado por uuid. Probado: pasa
 *    de `queued` a `cancelled` sin ejecutarse, y el turno en curso sigue
 *    intacto. No-op sobre un mensaje ya drenado al turno.
 * 2. `system/background_tasks_changed` — snapshot de tareas vivas. Probado: el
 *    `result` del turno llega ANTES del `task_notification`, así que una tarea
 *    sobrevive al turno y necesita su propio resumen fuera del historial.
 */

let nextId = 1;

function user(text: string, commandUuid: string | null = null): ChatMessage {
  return {
    id: nextId++,
    session_id: 's1',
    role: 'user',
    content: text,
    created_at: '2026-08-05 10:00:00',
    input_tokens: null,
    output_tokens: null,
    context_used_percent: null,
    duration_ms: null,
    attachments: null,
    command_uuid: commandUuid,
    answers_command_uuids: null,
  } as ChatMessage;
}

describe('applyCancelledMessage — quitar un mensaje de la cola', () => {
  it('saca de la cola el mensaje cancelado y deja el resto intacto', () => {
    const pending = [
      { uuid: 'u1', state: 'started' as const },
      { uuid: 'u2', state: 'queued' as const },
      { uuid: 'u3', state: 'queued' as const },
    ];

    const next: QueuedCommandLike[] = applyCancelledMessage(pending, 'u2');

    expect(next.map((c) => c.uuid)).toEqual(['u1', 'u3']);
  });

  it('no toca el mensaje que se está contestando', () => {
    // Cancelar uno de la cola no aborta el turno en curso — verificado: MSG1
    // completó su respuesta normal mientras MSG2 se cancelaba.
    const pending = [
      { uuid: 'u1', state: 'started' as const },
      { uuid: 'u2', state: 'queued' as const },
    ];

    const next = applyCancelledMessage(pending, 'u2');

    expect(next).toEqual([{ uuid: 'u1', state: 'started' }]);
  });

  it('es no-op sobre un mensaje que ya arrancó', () => {
    // "No-op if already dequeued for execution" — el CLI devuelve
    // cancelled:false. La UI no debe sacar la fila de la lista.
    const pending = [{ uuid: 'u1', state: 'started' as const }];

    expect(applyCancelledMessage(pending, 'u1')).toEqual(pending);
  });

  it('es no-op con un uuid que no está en la cola', () => {
    const pending = [{ uuid: 'u1', state: 'queued' as const }];

    expect(applyCancelledMessage(pending, 'no-existe')).toEqual(pending);
  });

  it('vacía la cola cuando se cancela el último que esperaba', () => {
    const pending = [{ uuid: 'u1', state: 'queued' as const }];

    expect(applyCancelledMessage(pending, 'u1')).toEqual([]);
  });

  it('deja de marcar la burbuja del mensaje cancelado', () => {
    // Después del ×, esa fila ya no muestra "En cola": no está esperando nada.
    const q1 = user('sigue', 'u1');
    const q2 = user('cancelada', 'u2');
    const pending = [
      { uuid: 'u1', state: 'started' as const },
      { uuid: 'u2', state: 'queued' as const },
    ];

    const next: QueuedCommandLike[] = applyCancelledMessage(pending, 'u2');
    const uuidsStillPending = new Set(next.map((c) => c.uuid));

    expect(uuidsStillPending.has(q1.command_uuid!)).toBe(true);
    expect(uuidsStillPending.has(q2.command_uuid!)).toBe(false);
  });
});

describe('summarizeBackgroundTasks — barra de tareas en background', () => {
  const task = (id: string, over: Partial<BackgroundTaskLike> = {}): BackgroundTaskLike => ({
    task_id: id,
    task_type: 'local_bash',
    description: `tarea ${id}`,
    ...over,
  });

  it('no muestra la barra sin tareas', () => {
    const summary: BackgroundSummaryLike = summarizeBackgroundTasks([]);

    expect(summary.visible).toBe(false);
    expect(summary.count).toBe(0);
  });

  it('cuenta las tareas vivas y muestra la barra', () => {
    const summary: BackgroundSummaryLike = summarizeBackgroundTasks([task('a'), task('b')]);

    expect(summary.visible).toBe(true);
    expect(summary.count).toBe(2);
  });

  it('trata el snapshot como la verdad completa, no como un delta', () => {
    // background_tasks_changed manda la lista entera cada vez; llega tasks:[]
    // cuando se vació. Acumular en vez de reemplazar dejaría tareas fantasma.
    const after: BackgroundSummaryLike = summarizeBackgroundTasks([]);

    expect(after.count).toBe(0);
    expect(after.visible).toBe(false);
  });

  it('conserva la descripción de cada tarea para listarlas', () => {
    const summary: BackgroundSummaryLike = summarizeBackgroundTasks([task('a', { description: 'Corriendo la suite de tests' })]);

    expect(summary.tasks[0]!.description).toBe('Corriendo la suite de tests');
  });

  it('distingue procesos dejados corriendo de subagentes del modelo', () => {
    // task_type no es solo bash: local_agent / local_workflow son el modelo
    // abriéndose en varios hilos. La barra los etiqueta distinto.
    const summary: BackgroundSummaryLike = summarizeBackgroundTasks([
      task('a', { task_type: 'local_bash' }),
      task('b', { task_type: 'local_agent' }),
    ]);

    expect(summary.tasks.map((t) => t.task_type)).toEqual(['local_bash', 'local_agent']);
  });

  it('es independiente del turno — las tareas sobreviven a que cierre', () => {
    // Verificado: el `result` llega ANTES del task_notification. Que el turno
    // haya cerrado no vacía la barra.
    const summary: BackgroundSummaryLike = summarizeBackgroundTasks([task('a')], { turnOpen: false });

    expect(summary.visible).toBe(true);
    expect(summary.count).toBe(1);
  });
});
