import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../chat-api.js';
import {
  groupByAnsweredQuestion,
  resolveQueueStates,
  countWaiting,
  isRemovableFromQueue,
} from '../chat-queue.js';

/**
 * Cobertura de la lógica de la lista del chat. Los escenarios son los que
 * modelamos como variantes en Figma (node 7662:36531): historial simple, un
 * turno que contesta varias preguntas, mensajes en cola, y el historial viejo
 * sin atribución que tiene que seguir renderizando.
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

function assistant(text: string, answers: string[] | null = null): ChatMessage {
  return {
    id: nextId++,
    session_id: 's1',
    role: 'assistant',
    content: text,
    created_at: '2026-08-05 10:00:01',
    input_tokens: 1200,
    output_tokens: 340,
    context_used_percent: 12,
    duration_ms: 2400,
    attachments: null,
    command_uuid: null,
    answers_command_uuids: answers,
  } as ChatMessage;
}

describe('groupByAnsweredQuestion', () => {
  it('deja el historial vacío como lista vacía', () => {
    expect(groupByAnsweredQuestion([])).toEqual([]);
  });

  it('arma un bloque pregunta→respuesta cuando el turno contestó uno solo', () => {
    const q = user('¿revisás el PR?', 'u1');
    const a = assistant('ya lo estoy viendo', ['u1']);

    const groups = groupByAnsweredQuestion([q, a]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.questions.map((m) => m.content)).toEqual(['¿revisás el PR?']);
    expect(groups[0]!.answer?.content).toBe('ya lo estoy viendo');
  });

  it('agrupa varias preguntas bajo la única respuesta que las contestó', () => {
    const q1 = user('¿revisás el PR?', 'u1');
    const q2 = user('y los tests rojos', 'u2');
    const a = assistant('las contesto juntas', ['u1', 'u2']);

    const groups = groupByAnsweredQuestion([q1, q2, a]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.questions.map((m) => m.content)).toEqual(['¿revisás el PR?', 'y los tests rojos']);
    expect(groups[0]!.answer?.content).toBe('las contesto juntas');
  });

  it('reordena el orden crudo q1 q2 q3 a1 a2 en bloques leíbles', () => {
    // Este es el caso que motiva la función: el usuario se persiste al
    // ENCOLARLO, así que la base guarda las tres preguntas antes de cualquier
    // respuesta y mirando el orden no se sabe quién contesta a quién.
    const q1 = user('primera', 'u1');
    const q2 = user('segunda', 'u2');
    const q3 = user('tercera', 'u3');
    const a1 = assistant('contesta la primera', ['u1']);
    const a2 = assistant('contesta las otras dos', ['u2', 'u3']);

    const groups = groupByAnsweredQuestion([q1, q2, q3, a1, a2]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.questions.map((m) => m.content)).toEqual(['primera']);
    expect(groups[0]!.answer?.content).toBe('contesta la primera');
    expect(groups[1]!.questions.map((m) => m.content)).toEqual(['segunda', 'tercera']);
    expect(groups[1]!.answer?.content).toBe('contesta las otras dos');
  });

  it('deja las preguntas sin contestar en un bloque sin respuesta', () => {
    const q1 = user('contestada', 'u1');
    const a1 = assistant('acá va', ['u1']);
    const q2 = user('todavía en cola', 'u2');

    const groups = groupByAnsweredQuestion([q1, a1, q2]);

    expect(groups).toHaveLength(2);
    expect(groups[1]!.answer).toBeUndefined();
    expect(groups[1]!.questions.map((m) => m.content)).toEqual(['todavía en cola']);
  });

  it('renderiza cronológico el historial viejo sin atribución (fail-soft)', () => {
    // Sin command_uuid ni answers_command_uuids: el camino spawn-per-turn y todo
    // lo anterior a la migración. Tiene que seguir viéndose como antes.
    const q = user('vieja pregunta');
    const a = assistant('vieja respuesta');

    const groups = groupByAnsweredQuestion([q, a]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.questions.map((m) => m.content)).toEqual(['vieja pregunta']);
    expect(groups[0]!.answer?.content).toBe('vieja respuesta');
  });

  it('ignora un uuid que no corresponde a ninguna pregunta del historial', () => {
    // Puede pasar si la pregunta quedó fuera de la página de historial cargada.
    const a = assistant('respuesta huérfana', ['no-existe']);

    const groups = groupByAnsweredQuestion([a]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.questions).toEqual([]);
    expect(groups[0]!.answer?.content).toBe('respuesta huérfana');
  });

  it('emite cada mensaje exactamente una vez — nunca duplica ni pierde', () => {
    const q1 = user('a', 'u1');
    const q2 = user('b', 'u2');
    const q3 = user('c');
    const a1 = assistant('r1', ['u1', 'u2']);
    const a2 = assistant('r2');
    const input = [q1, q2, q3, a1, a2];

    const groups = groupByAnsweredQuestion(input);

    const emitted = groups.flatMap((g) => [...g.questions, ...(g.answer ? [g.answer] : [])]);
    expect(emitted).toHaveLength(input.length);
    expect(new Set(emitted.map((m) => m.id)).size).toBe(input.length);
  });

  it('da una key distinta a cada bloque', () => {
    const q1 = user('a', 'u1');
    const a1 = assistant('r1', ['u1']);
    const q2 = user('b', 'u2');

    const keys = groupByAnsweredQuestion([q1, a1, q2]).map((g) => g.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('resolveQueueStates', () => {
  it('marca cada mensaje del historial con el estado que reporta el stream', () => {
    const q1 = user('primera', 'u1');
    const q2 = user('segunda', 'u2');

    const states = resolveQueueStates(
      [q1, q2],
      [
        { uuid: 'u1', state: 'started' },
        { uuid: 'u2', state: 'queued' },
      ],
    );

    expect(states.get(q1.id)).toBe('started');
    expect(states.get(q2.id)).toBe('queued');
  });

  it('no marca los mensajes que ya fueron contestados', () => {
    const q = user('contestada', 'u1');

    const states = resolveQueueStates([q], []);

    expect(states.has(q.id)).toBe(false);
  });

  it('matchea por uuid y no por texto — dos mensajes iguales no se confunden', () => {
    const q1 = user('hola', 'u1');
    const q2 = user('hola', 'u2');

    const states = resolveQueueStates([q1, q2], [{ uuid: 'u2', state: 'queued' }]);

    expect(states.has(q1.id)).toBe(false);
    expect(states.get(q2.id)).toBe('queued');
  });

  it('muestra "sending" en una burbuja optimista que todavía no tiene uuid', () => {
    // El hueco entre el click y la respuesta del POST no debe quedar sin marca.
    const states = resolveQueueStates([], [], new Map([[999, null]]));

    expect(states.get(999)).toBe('sending');
  });

  it('pasa la burbuja optimista al estado real una vez que conoce su uuid', () => {
    const states = resolveQueueStates([], [{ uuid: 'u1', state: 'queued' }], new Map([[999, 'u1']]));

    expect(states.get(999)).toBe('queued');
  });

  it('deja la burbuja optimista en "sending" si su uuid todavía no está en la cola', () => {
    const states = resolveQueueStates([], [], new Map([[999, 'u1']]));

    expect(states.get(999)).toBe('sending');
  });
});

describe('countWaiting', () => {
  it('cuenta cero con la cola vacía', () => {
    expect(countWaiting(new Map())).toBe(0);
  });

  it('no cuenta el mensaje que ya se está contestando', () => {
    // El pill dice "2 esperando" con 3 en la cola: el que corre no espera.
    const states = new Map<number, 'sending' | 'queued' | 'started'>([
      [1, 'started'],
      [2, 'queued'],
      [3, 'queued'],
    ]);

    expect(countWaiting(states)).toBe(2);
  });

  it('cuenta los que todavía no llegaron al server', () => {
    const states = new Map<number, 'sending' | 'queued' | 'started'>([
      [1, 'started'],
      [2, 'sending'],
    ]);

    expect(countWaiting(states)).toBe(1);
  });
});

describe('isRemovableFromQueue', () => {
  it('permite sacar un mensaje que todavía no arrancó', () => {
    expect(isRemovableFromQueue('queued')).toBe(true);
  });

  it('NO permite sacar el que ya está corriendo', () => {
    // cancel_async_message es no-op una vez drenado al turno — verificado
    // contra el CLI real 2.1.220. Ofrecer el botón ahí sería mentir.
    expect(isRemovableFromQueue('started')).toBe(false);
  });

  it('no ofrece quitar un mensaje ya contestado', () => {
    expect(isRemovableFromQueue(undefined)).toBe(false);
  });
});
