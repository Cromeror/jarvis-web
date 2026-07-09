import React from 'react';

export type AvatarRole = 'user' | 'assistant';

interface AvatarProps {
  role: AvatarRole;
}

export function Avatar({ role }: AvatarProps): React.ReactElement {
  const isUser = role === 'user';
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
        isUser ? 'bg-slate-600' : 'bg-indigo-600'
      }`}
    >
      {isUser ? 'Tú' : 'J'}
    </div>
  );
}
