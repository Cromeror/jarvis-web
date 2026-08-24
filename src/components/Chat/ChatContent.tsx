import React from 'react';
import type { ChatSession } from '../../lib/chat-api.js';
import type { ProjectSummary } from '../../lib/projects-api.js';
import { ProjectTabStrip } from './ProjectTabStrip.js';
import { ConversationSwitcher } from './ConversationSwitcher.js';
import { NewSessionButton } from './NewSessionButton.js';
import { ChatInputBar } from '../ui/molecules/ChatInputBar.js';
import { BackgroundTasksBar, type BackgroundTaskView } from '../ui/molecules/BackgroundTasksBar.js';

interface ChatContentProps {
  sessions: ChatSession[];
  projects: ProjectSummary[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  pendingSessionIds: Set<string>;
  unreadSessionIds: Set<string>;
  onSelectSession: (sessionId: string) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onNewSession: (projectId: string) => void;
  onSend: (message: string, attachments?: File[], planMode?: boolean) => void;
  planMode?: boolean;
  onTogglePlanMode?: (next: boolean) => void;
  /**
   * Bloquea la barra de escribir. Por default NO se bloquea mientras Jarvis
   * trabaja: el CLI acepta mensajes en pleno turno (los funde en el turno en
   * curso o los encola detrás), así que deshabilitar el input sería una
   * restricción nuestra, no del motor.
   */
  inputDisabled?: boolean;
  /** True mientras Jarvis contesta — habilita el Detener dentro del composer expandido. */
  turnInFlight?: boolean;
  /** Detiene el turno en curso. Llega hasta el composer porque en pantalla completa tapa el Detener de la lista. */
  onStop?: () => void;
  /**
   * Tareas que Jarvis dejó corriendo. La barra vive acá y no dentro de la lista
   * de mensajes: tiene que quedar visible sin scrollear.
   */
  backgroundTasks?: BackgroundTaskView[];
  onStopBackgroundTask?: (taskId: string) => void;
  onStopAllBackgroundTasks?: () => void;
  /** Área de contenido (mensajes o estado vacío) — la arma quien use ChatContent, acá solo se envuelve. */
  children: React.ReactNode;
}

/**
 * ChatContent — organismo "DBoard V1.1.X" de Figma (node 7658:1930): el shell
 * completo del chat — fondo oscuro con gradiente (mismo patrón que Sidebar2/
 * ChatOptionsRail), TopRow (tab-strip de proyectos + buscador global + nueva
 * conversación) y la barra de escribir. El área de mensajes queda como
 * `children` porque en Figma esa parte solo modela el estado vacío — el
 * listado de mensajes real es lógica de `ChatWindow`, no diseño propio de
 * este organismo.
 */
export function ChatContent({
  sessions,
  projects,
  activeProjectId,
  activeSessionId,
  pendingSessionIds,
  unreadSessionIds,
  onSelectSession,
  onSelectProject,
  onDeleteSession,
  onRenameSession,
  onNewSession,
  onSend,
  planMode,
  onTogglePlanMode,
  inputDisabled = false,
  turnInFlight,
  onStop,
  backgroundTasks,
  onStopBackgroundTask,
  onStopAllBackgroundTasks,
  children,
}: ChatContentProps): React.ReactElement {
  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--chatcontent-radius)] bg-[var(--chatcontent-bg-base)] bg-gradient-to-b from-[var(--chatcontent-bg-from)] to-[var(--chatcontent-bg-to)]">
      <div className="flex items-center gap-2 border-b border-[var(--chatcontent-border-subtle)] px-3 py-2">
        <ProjectTabStrip sessions={sessions} projects={projects} activeProjectId={activeProjectId} onSelectProject={onSelectProject} />
        <div className="ml-auto flex items-center gap-1">
          <ConversationSwitcher
            sessions={sessions}
            projects={projects}
            activeSessionId={activeSessionId}
            pendingSessionIds={pendingSessionIds}
            unreadSessionIds={unreadSessionIds}
            onSelect={onSelectSession}
            onDelete={onDeleteSession}
            onRename={onRenameSession}
          />
          <NewSessionButton projects={projects} activeProjectId={activeProjectId} onCreate={onNewSession} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {/*
        La barra va acá, HERMANA del área que scrollea y no adentro.
        Adentro de `overflow-y-auto` el panel se desplegaba hacia abajo, fuera
        del viewport: había que scrollear para ver las tareas y el auto-scroll al
        fondo tardaba en reacomodarse. Como hermana del input queda siempre
        visible y crece hacia arriba comiendo alto de la conversación, que es lo
        que uno espera de una barra de estado.
      */}
      {backgroundTasks && backgroundTasks.length > 0 && (
        <BackgroundTasksBar
          tasks={backgroundTasks}
          onStopTask={onStopBackgroundTask}
          onStopAll={onStopAllBackgroundTasks}
        />
      )}
      <ChatInputBar
        disabled={inputDisabled}
        onSend={onSend}
        planMode={planMode}
        onTogglePlanMode={onTogglePlanMode}
        turnInFlight={turnInFlight}
        onStop={onStop}
      />
    </div>
  );
}
