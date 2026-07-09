import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Avatar } from '../atoms/Avatar.js';

interface MessageBubbleProps {
  role: string;
  content: string;
}

function CodeBlock({ children }: { children: React.ReactNode }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const text = String(children).replace(/\n$/, '');

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl bg-slate-900">
      <div className="flex items-center justify-between px-4 py-1.5">
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pb-3 text-sm text-slate-100">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export function MessageBubble({ role, content }: MessageBubbleProps): React.ReactElement {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar role="assistant" />
      <div className="min-w-0 max-w-[85%] flex-1 text-sm leading-relaxed text-slate-800 [&_a]:text-indigo-600 [&_a]:underline [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_hr]:my-3 [&_hr]:border-slate-200 [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const isBlock = /language-/.test(className ?? '') || String(children).includes('\n');
              if (isBlock) return <CodeBlock>{children}</CodeBlock>;
              return (
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-slate-800" {...props}>
                  {children}
                </code>
              );
            },
            pre({ children }) {
              return <>{children}</>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
