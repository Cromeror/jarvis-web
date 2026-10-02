import React from 'react';
import { Markdown } from '../atoms/Markdown.js';
import { Icon } from '../../Icon.js';
import { useAuth } from '../../../hooks/useAuth.js';

interface MessageBubbleProps {
  role: string;
  content: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  contextUsedPercent?: number | null;
  durationMs?: number | null;
  attachments?: string | null;
  /**
   * Estado de un mensaje del usuario que Jarvis todavía no contestó:
   * 'sending' = local, apenas se apretó enviar y el server todavía no
   * confirmó; 'queued' = ya está en la cola del CLI esperando su turno;
   * 'started' = lo está respondiendo ahora. Ausente cuando ya fue contestado
   * (que es el caso de todo el historial).
   */
  queueState?: 'sending' | 'queued' | 'started';
}

/** Parses the JSON `attachments` column into filenames, fail-soft on malformed/missing data. */
function parseAttachmentNames(attachments?: string | null): string[] {
  if (!attachments) return [];
  try {
    const parsed = JSON.parse(attachments) as Array<{ filename?: string }>;
    return parsed.map((a) => a.filename).filter((f): f is string => Boolean(f));
  } catch {
    return [];
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

/** Las iniciales del avatar, como las arma el template: hasta dos, en mayúscula. */
function initials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ESTADO_EN_COLA: Record<string, string> = {
  sending: 'Enviando…',
  queued: 'En cola',
  started: 'Respondiendo…',
};

/**
 * UN TURNO DEL HILO — `.sw-msg` del template (`chat.js`, `message()`).
 *
 * LOS DOS ROLES SE DIBUJAN IGUAL: fila de nombre arriba, cuerpo abajo, mismo
 * cuerpo de letra. No hay burbuja ni alineación a la derecha. Quién habla se
 * distingue por el nodo del carril —relleno en la IA, anillo en el usuario— y
 * por el avatar, que son dos trabajos distintos: el nodo dice DÓNDE cae el
 * turno en el hilo, el avatar dice QUIÉN habla.
 *
 * Antes esto eran dos diseños: una burbuja azul a la derecha para el usuario y
 * texto suelto con `prose` de Tailwind para la IA. De ahí salía lo que se veía
 * mal — `prose` trae su propia escala tipográfica, así que la respuesta se leía
 * más grande que lo que el usuario acababa de escribir, y ninguno de los dos
 * tenía que ver con el chat que los rodea.
 *
 * Por eso el markdown va SIN `prose`: los elementos salen pelados y los viste
 * `.sw-msg__body`, que es donde el tema ya tiene decidido el cuerpo, la
 * interlínea y la pastilla del código en línea.
 */
export function MessageBubble({
  role,
  content,
  inputTokens,
  outputTokens,
  contextUsedPercent,
  durationMs,
  attachments,
  queueState,
}: MessageBubbleProps): React.ReactElement {
  const { user } = useAuth();
  const isUser = role === 'user';
  const nombre = isUser ? user?.username ?? 'Vos' : 'Jarvis';

  const attachmentNames = parseAttachmentNames(attachments);
  const hasTokens = inputTokens != null || outputTokens != null;
  const metricas = !isUser && (hasTokens || contextUsedPercent != null || durationMs != null);

  return (
    <div className={`sw-msg sw-msg--${isUser ? 'user' : 'ai'}`}>
      <div className="sw-msg__who">
        {isUser ? (
          /* El MISMO componente que el avatar del topbar (la primitiva `avatar`
             de Basecoat) con las mismas iniciales: es la misma persona, y dos
             dibujos distintos para una identidad se leen como dos identidades. */
          <span className="avatar sw-msg__av" data-size="sm" aria-hidden="true">
            <span>{initials(nombre)}</span>
          </span>
        ) : (
          <Icon name="audioLines" />
        )}
        <span className="sw-msg__nombre">{nombre}</span>
        {queueState && <span>{ESTADO_EN_COLA[queueState]}</span>}
      </div>

      {attachmentNames.length > 0 && (
        /* Los mismos chips que el composer: es el mismo objeto —un archivo con
           su ícono y su nombre— en otro momento de su vida. Acá sin el ✕: ya se
           mandó, no hay nada que sacar. */
        <div className="sw-comp__adj">
          {attachmentNames.map((name, i) => (
            <span key={`${name}-${i}`} className="sw-comp__adjunto">
              <Icon name="doc" />
              <span className="sw-comp__an">{name}</span>
            </span>
          ))}
        </div>
      )}

      <div className="sw-msg__body">
        {/* Lo del usuario va TAL CUAL lo escribió: interpretarle el markdown le
            cambiaría el texto que tiene delante —un `*` se convertiría en
            bastardilla— y no es lo que tipeó. */}
        {isUser ? <p className="sw-msg__literal">{content}</p> : <Markdown prosa={false}>{content}</Markdown>}
      </div>

      {metricas && (
        <p className="sw-msg__metricas">
          {hasTokens && `${inputTokens ?? 0} in · ${outputTokens ?? 0} out`}
          {contextUsedPercent != null && `${hasTokens ? ' · ' : ''}${contextUsedPercent}% de contexto`}
          {durationMs != null && ` · ${formatDuration(durationMs)}`}
        </p>
      )}
    </div>
  );
}
