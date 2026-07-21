import React from 'react';
import ReactMarkdown from 'react-markdown';

interface PlanMarkdownProps {
  children: string;
  className?: string;
}

/** Markdown rendering shared by the plan side panel and the fullscreen modal — same treatment as ChatWindow's MessageBubble, tuned down a size since plan text sits in denser panels. */
export function PlanMarkdown({ children, className }: PlanMarkdownProps): React.ReactElement {
  return (
    <div
      className={
        'text-sm leading-relaxed text-slate-700 [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold ' +
        '[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold ' +
        '[&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:font-semibold ' +
        '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-indigo-600 [&_a]:underline ' +
        '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] ' +
        '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:px-3 [&_pre]:py-2 [&_pre_code]:bg-transparent [&_pre_code]:text-slate-100 ' +
        (className ?? '')
      }
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
