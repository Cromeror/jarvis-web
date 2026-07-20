import React, { useEffect, useRef, useState } from 'react';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatInputBarProps {
  disabled?: boolean;
  onSend: (message: string, attachments?: File[], planMode?: boolean) => void;
  planMode?: boolean;
  onTogglePlanMode?: (next: boolean) => void;
}

export function ChatInputBar({ disabled = false, onSend, planMode = false, onTogglePlanMode }: ChatInputBarProps): React.ReactElement {
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
    onSend(trimmed, attachments.length ? attachments : undefined, planMode);
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
    <div className="border-t border-slate-200 bg-white p-4">
      <div className="mx-auto max-w-3xl">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
              >
                {file.name}
                <span className="text-slate-400">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label={`Quitar ${file.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div
          className={`relative flex items-end gap-2 rounded-3xl border bg-white p-2 shadow-sm transition-colors ${
            showExpandButton ? 'pr-10' : ''
          } ${focused ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-200'}`}
        >
          {showExpandButton && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              disabled={disabled}
              title="Expandir a pantalla completa"
              aria-label="Expandir a pantalla completa"
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500 disabled:opacity-30"
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
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
          {onTogglePlanMode && (
            <button
              type="button"
              onClick={() => onTogglePlanMode(!planMode)}
              disabled={disabled}
              aria-pressed={planMode}
              title={planMode ? 'Modo Plan activo — el próximo mensaje propone un plan en vez de actuar' : 'Activar Modo Plan'}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-30 ${
                planMode
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="M9 3h6l1 4h4l-1 4-3 1-1 5-3 3-3-3-1-5-3-1-1-4h4l1-4Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Plan
            </button>
          )}
          <textarea
            ref={textareaRef}
            className="max-h-[40vh] flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-[16px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
            rows={1}
            placeholder={planMode ? 'Describí qué querés planear...' : 'Escribí un mensaje...'}
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-opacity hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600"
            aria-label="Enviar mensaje"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-medium text-slate-500">Escribir mensaje</span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Minimizar"
              className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <i className="pi pi-window-minimize text-sm" />
              Minimizar
            </button>
          </div>
          <textarea
            ref={expandedTextareaRef}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-[17px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder={planMode ? 'Describí qué querés planear...' : 'Escribí un mensaje...'}
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleExpandedKeyDown}
            onPaste={handlePaste}
          />
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
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
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-opacity hover:bg-indigo-700 disabled:opacity-30"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
