import React, { useEffect, useRef, useState } from 'react';
import { Spinner } from '../atoms/Spinner.js';
import { Button } from '../atoms/Button.js';
import { Icon } from '../../Icon.js';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS as ADJUNTOS_ACEPTADOS,
  formatAttachmentSize as formatFileSize,
  splitByAcceptedFormat,
} from '../../../lib/chat-attachments.js';

interface ChatInputBarProps {
  disabled?: boolean;
  onSend: (message: string, attachments?: File[]) => void;
  /**
   * True mientras Jarvis está contestando. Solo se usa para mostrar el stop
   * dentro del composer expandido.
   */
  turnInFlight?: boolean;
  /**
   * Detiene el turno en curso.
   *
   * Hace falta acá porque el composer expandido es un `fixed inset-0` que cubre
   * la lista de mensajes — y el único botón Detener vivía ahí adentro. Escribir
   * en pantalla completa mientras Jarvis trabajaba dejaba al usuario sin forma
   * de cortar: el botón no desaparecía, quedaba debajo del overlay. Se volvió
   * fácil de encontrar desde que el input ya no se bloquea durante el turno.
   */
  onStop?: () => void;
}

export function ChatInputBar({
  disabled = false,
  onSend,
  turnInFlight = false,
  onStop,
}: ChatInputBarProps): React.ReactElement {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  /** Nombres de lo último que se intentó adjuntar y no es un formato que el chat pueda leer. */
  const [rechazados, setRechazados] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Altura de una sola línea, capturada la primera vez (textarea vacío) —
  // referencia para saber si ya se pasó a una segunda línea.
  const singleLineHeightRef = useRef<number | null>(null);

  // Crece con el contenido — el tope real lo pone max-h-[40vh] en la clase
  // (relativo al viewport, así "crece tanto como permite la pantalla" tanto
  // en mobile como en desktop); pasado eso, scrollea adentro del textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (singleLineHeightRef.current == null) singleLineHeightRef.current = el.scrollHeight;
    el.style.height = `${el.scrollHeight}px`;
    setShowExpandButton(el.scrollHeight > singleLineHeightRef.current + 1);
  }, [value]);

  useEffect(() => {
    if (expanded) expandedTextareaRef.current?.focus();
  }, [expanded]);

  const addFiles = (files: FileList | File[]): void => {
    const { accepted, rejected } = splitByAcceptedFormat(files);
    // Se avisa cuáles quedaron afuera: descartarlos en silencio es el mismo
    // problema que tenía el backend, sólo que del lado del usuario.
    setRechazados(rejected);
    if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
  };

  const removeAttachment = (index: number): void => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setRechazados([]);
  };

  const handleSend = (): void => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend(trimmed, attachments.length ? attachments : undefined);
    setValue('');
    setAttachments([]);
    setRechazados([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExpandedKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      setExpanded(false);
    } else if (e.key === 'Escape') {
      setExpanded(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length) addFiles(files);
  };

  return (
    <div className="border-t border-border p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {rechazados.length > 0 && (
          <div className="rounded-[var(--sw-r-md)] bg-[var(--sw-error-bg)] px-3 py-2 text-xs text-[var(--sw-on-error)]" role="alert">
            No se puede adjuntar {rechazados.join(', ')}: el chat sólo lee imágenes, PDF y Markdown (
            {ADJUNTOS_ACEPTADOS.join(', ')}).
          </div>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className="flex items-center gap-1 rounded-[var(--sw-r-pill)] bg-muted px-3 py-1 text-xs text-foreground"
              >
                {file.name}
                <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Quitar ${file.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {/* El foco lo marca el CONTENEDOR (borde de acento) y no el textarea: si
            no, el anillo global de :focus-visible dibuja una segunda línea
            adentro de la caja. Mismo criterio que `.sw-comp__campo` del chat
            flotante. El `!` hace falta porque esa regla global no está en una
            capa y le gana a cualquier utilidad de Tailwind sin él. */}
        <div
          className={`relative flex items-end gap-[var(--sw-s-2)] rounded-[var(--sw-r-lg)] border bg-[var(--sw-raised)] px-[var(--sw-s-2)] py-[var(--sw-s-2)] transition-colors ${
            showExpandButton ? 'pr-10' : ''
          } ${focused ? 'border-[var(--sw-accent)]' : 'border-[var(--sw-line-strong)]'}`}
        >
          {showExpandButton && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              disabled={disabled}
              title="Expandir a pantalla completa"
              aria-label="Expandir a pantalla completa"
              className="btn absolute right-2 top-2 text-muted-foreground"
              data-variant="ghost"
              data-size="icon-sm"
            >
              <Icon name="maximize" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ADJUNTOS_ACEPTADOS.join(',')}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) fileInputRef.current.value = '';
              fileInputRef.current?.click();
            }}
            disabled={disabled}
            className="btn shrink-0 text-secondary-foreground"
            data-variant="ghost"
            data-size="icon-sm"
            aria-label="Adjuntar archivo"
          >
            <Icon name="clip" />
          </button>
          <textarea
            ref={textareaRef}
            className="max-h-[40vh] flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-[16px] text-foreground placeholder:text-[var(--sw-placeholder)] focus-visible:!outline-none disabled:opacity-50"
            rows={1}
            placeholder="Escribí un mensaje..."
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || (!value.trim() && attachments.length === 0)}
            className="btn shrink-0"
            data-size="icon-sm"
            aria-label="Enviar mensaje"
          >
            <Icon name="send" />
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[var(--sw-ink)]"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">Escribir mensaje</span>
            <Button variant="outline" size="md" onClick={() => setExpanded(false)} aria-label="Minimizar">
              <Icon name="minus" />
              Minimizar
            </Button>
          </div>
          <textarea
            ref={expandedTextareaRef}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-[17px] leading-relaxed text-foreground placeholder:text-[var(--sw-placeholder)] focus:outline-none"
            placeholder="Escribí un mensaje..."
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleExpandedKeyDown}
            onPaste={handlePaste}
          />
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            {turnInFlight && onStop && (
              // A la izquierda del resto: el overlay tapa el Detener de la
              // lista, así que sin esto no habría cómo cortar el turno sin
              // salir del composer primero.
              <Button variant="outline" size="md" onClick={onStop} className="mr-auto">
                <Spinner className="h-3 w-3" />
                Detener
              </Button>
            )}
            <Button variant="ghost" size="md" onClick={() => setExpanded(false)}>
              Seguir editando
            </Button>
            <Button
              size="md"
              onClick={() => {
                handleSend();
                setExpanded(false);
              }}
              disabled={disabled || (!value.trim() && attachments.length === 0)}
            >
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
