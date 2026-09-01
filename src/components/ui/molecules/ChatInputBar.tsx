import React, { useEffect, useRef, useState } from 'react';
import { Spinner } from '../atoms/Spinner.js';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const removeAttachment = (index: number): void => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = (): void => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend(trimmed, attachments.length ? attachments : undefined);
    setValue('');
    setAttachments([]);
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
    <div className="border-t border-[var(--chatcontent-border-subtle)] p-4">
      <div className="mx-auto max-w-3xl">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-[var(--tab-text-hover)]"
              >
                {file.name}
                <span className="text-[var(--chatcontent-text-muted)]">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-[var(--chatcontent-text-muted)] hover:text-[var(--tab-text-hover)]"
                  aria-label={`Quitar ${file.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div
          className={`relative flex items-end gap-[var(--chatinput-gap)] rounded-[var(--chatinput-radius)] border bg-[var(--chatinput-bg)] px-[var(--chatinput-padding-h)] py-[var(--chatinput-padding-v)] transition-colors ${
            showExpandButton ? 'pr-10' : ''
          } ${focused ? 'border-[var(--sidebar2-accent-default)]' : 'border-[var(--chatinput-border)]'}`}
        >
          {showExpandButton && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              disabled={disabled}
              title="Expandir a pantalla completa"
              aria-label="Expandir a pantalla completa"
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-[var(--chatcontent-text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--tab-text-hover)] disabled:opacity-30"
            >
              <i className="pi pi-window-maximize text-xs" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
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
            className="flex shrink-0 items-center justify-center rounded-[8px] p-2 text-[var(--tab-text-default)] transition-colors hover:bg-white/10 hover:text-[var(--tab-text-hover)] disabled:opacity-30"
            aria-label="Adjuntar archivo"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.2 9.19a1.5 1.5 0 01-2.12-2.12l8.49-8.48"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            className="max-h-[40vh] flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-[16px] text-white placeholder:text-[var(--chatinput-placeholder-text)] focus:outline-none disabled:opacity-50"
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
            className="flex shrink-0 items-center justify-center rounded-[8px] bg-[var(--sidebar2-accent-default)] p-2 text-white transition-colors hover:bg-[var(--buttonicon-primary-bg-hover)] disabled:opacity-30"
            aria-label="Enviar mensaje"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[var(--chatcontent-bg-base)] bg-gradient-to-b from-[var(--chatcontent-bg-from)] to-[var(--chatcontent-bg-to)]"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between border-b border-[var(--chatcontent-border-subtle)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--chatcontent-text-muted)]">Escribir mensaje</span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Minimizar"
              className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--chatcontent-border-subtle)] px-3 text-sm font-medium text-[var(--tab-text-hover)] hover:bg-white/10"
            >
              <i className="pi pi-window-minimize text-sm" />
              Minimizar
            </button>
          </div>
          <textarea
            ref={expandedTextareaRef}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-[17px] leading-relaxed text-white placeholder:text-[var(--chatcontent-text-muted)] focus:outline-none"
            placeholder="Escribí un mensaje..."
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleExpandedKeyDown}
            onPaste={handlePaste}
          />
          <div className="flex items-center justify-end gap-2 border-t border-[var(--chatcontent-border-subtle)] px-4 py-3">
            {turnInFlight && onStop && (
              // A la izquierda del resto: el overlay tapa el Detener de la
              // lista, así que sin esto no habría cómo cortar el turno sin
              // salir del composer primero.
              <button
                type="button"
                onClick={onStop}
                className="mr-auto flex items-center gap-1.5 rounded-full border border-[var(--chatcontent-border-subtle)] px-4 py-2 text-sm font-medium text-[var(--tab-text-hover)] hover:bg-white/10"
              >
                <Spinner className="h-3 w-3" />
                Detener
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--tab-text-default)] hover:bg-white/10"
            >
              Seguir editando
            </button>
            <button
              type="button"
              onClick={() => {
                handleSend();
                setExpanded(false);
              }}
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              className="rounded-full bg-[var(--sidebar2-accent-default)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--buttonicon-primary-bg-hover)] disabled:opacity-30"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
