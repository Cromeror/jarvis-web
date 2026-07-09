import React, { useState } from 'react';

interface ChatInputBarProps {
  disabled?: boolean;
  onSend: (message: string) => void;
}

export function ChatInputBar({ disabled = false, onSend }: ChatInputBarProps): React.ReactElement {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSend = (): void => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <div
        className={`mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border bg-white p-2 shadow-sm transition-colors ${
          focused ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-200'
        }`}
      >
        <textarea
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          rows={1}
          placeholder="Escribí un mensaje..."
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-opacity hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600"
          aria-label="Enviar mensaje"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
