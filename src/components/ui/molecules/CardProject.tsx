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

/** Relative "hace X" from an ISO timestamp — mismo criterio que ProjectCard/PlansPage. */
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
 * CardProject — molécula del design system "DBoard V1.1.X" (Figma node
 * 3243:128808/2778:70707). Envuelve CardBase (gap "md") con título, fila
 * de ambientes y hasta 3 chats recientes. Ajustado a pedido: se sacaron
 * el slug del proyecto, la meta de integraciones/skills y, por último, el
 * indicador de última actividad arriba (TopRow) — redundante una vez que
 * la sección de chats ya muestra el tiempo relativo de cada uno. Todo
 * reflejado primero en Figma (misma edición) y portado acá. No reemplaza
 * a ui/molecules/ProjectCard.tsx (tema claro, usado hoy en DashboardPage)
 * — mismo criterio que Sidebar2/RecentPipelinesTable2.
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
      <p className="w-full truncate text-[15px] font-semibold text-[var(--card-text-primary)]">{title}</p>

      {environments.length > 0 && (
        <div className="flex items-center gap-2">
          {environments.map((env) => (
            <div key={env.name} className="flex items-center gap-1">
              <span
                className={`size-[6px] shrink-0 rounded-[3px] ${
                  env.active ? 'bg-[var(--card-env-active)]' : 'bg-[var(--card-env-inactive)]'
                }`}
              />
              <p className="whitespace-nowrap text-[11px] text-[var(--card-text-secondary)]">{env.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gap extra vs. el resto de las filas — ver comentario de --card-chats-section-gap en styles-tailwind.css */}
      <div className="h-[var(--card-chats-section-gap)] w-full shrink-0" />
      <div className="flex w-full flex-col gap-[var(--card-gap)]">
        <p className="text-[11px] text-[var(--card-text-secondary)]">
          {chatsCount} chat{chatsCount !== 1 ? 's' : ''}
        </p>
        {recentChats.length > 0 ? (
          <div className="flex w-full flex-col gap-[var(--card-chats-gap)]">
            {recentChats.map((chat) => (
              <div key={chat.id} className="flex w-full items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-[11px] text-[var(--card-text-secondary)]">
                  {chat.title ?? 'Sin título'}
                </p>
                <p className="shrink-0 whitespace-nowrap text-[11px] text-[var(--card-text-secondary)]">
                  {timeAgo(chat.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] italic text-[var(--card-text-secondary)] opacity-60">Sin conversaciones todavía</p>
        )}
      </div>
    </CardBase>
  );
}
