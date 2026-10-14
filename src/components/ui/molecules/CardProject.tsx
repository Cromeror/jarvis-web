import React from 'react';
import { CardBase } from '../atoms/CardBase.js';

export interface CardProjectEnvironment {
  name: string;
  active: boolean;
}

export interface CardProjectChat {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface CardProjectProps {
  title: string;
  environments: CardProjectEnvironment[];
  chatsCount: number;
  recentChats: CardProjectChat[];
  onClick?: () => void;
  className?: string;
}

/** Relative "hace X" from an ISO timestamp — mismo criterio que PlansPage. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

/**
 * CardProject — la card de un proyecto en el Dashboard: título, fila de
 * ambientes y hasta 3 chats recientes. Se sacaron a pedido el slug, la meta de
 * integraciones/skills y el indicador de última actividad arriba —redundante
 * una vez que la sección de chats ya muestra el tiempo relativo de cada uno—.
 *
 * El punto de un ambiente es de ESTADO (prendido/apagado), así que sale del
 * token de éxito del tema y no de un verde fijo: en claro y en oscuro tiene
 * que leerse igual contra la card.
 */
export function CardProject({
  title,
  environments,
  chatsCount,
  recentChats,
  onClick,
  className = '',
}: CardProjectProps): React.ReactElement {
  return (
    <CardBase gap="md" onClick={onClick} className={`w-full ${className}`}>
      <p className="w-full truncate text-[15px] font-semibold text-foreground">{title}</p>

      {environments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {environments.map((env) => (
            <div key={env.name} className="flex items-center gap-1">
              <span
                className={`size-[6px] shrink-0 rounded-full ${
                  env.active ? 'bg-[var(--sw-success)]' : 'bg-[var(--sw-faint)]'
                }`}
              />
              <p className="whitespace-nowrap text-[11px] text-muted-foreground">{env.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* `mt-auto` empuja los chats al pie de la card: con alto fijo en la
          grilla, así quedan alineados entre cards aunque una tenga ambientes y
          otra no. */}
      <div className="mt-auto flex w-full flex-col gap-[var(--sw-s-2)]">
        <p className="text-[11px] text-muted-foreground">
          {chatsCount} chat{chatsCount !== 1 ? 's' : ''}
        </p>
        {recentChats.length > 0 ? (
          <div className="flex w-full flex-col gap-[var(--sw-s-1)]">
            {recentChats.map((chat) => (
              <div key={chat.id} className="flex w-full items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-[11px] text-secondary-foreground">
                  {chat.title ?? 'Sin título'}
                </p>
                <p className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                  {timeAgo(chat.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] italic text-muted-foreground">Sin conversaciones todavía</p>
        )}
      </div>
    </CardBase>
  );
}
