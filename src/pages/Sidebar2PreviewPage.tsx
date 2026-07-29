import React, { useState } from 'react';
import { Sidebar2 } from '../components/ui/organisms/Sidebar2.js';
import { CardBase } from '../components/ui/atoms/CardBase.js';
import { CardProject } from '../components/ui/molecules/CardProject.js';
import { RecentPipelinesTable2, type RecentPipelinesTable2Row } from '../components/ui/organisms/RecentPipelinesTable2.js';
import { ChatOptionsRail } from '../components/ui/organisms/ChatOptionsRail.js';

// Timestamps calculados para reproducir los "hace Xh/d" del frame de Figma (CardProject).
const SAMPLE_RECENT_CHATS = [
  { id: '1', title: 'Fix login bug', updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: '2', title: 'Refactor sidebar', updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  { id: '3', title: 'Update deps', updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
];

// Filas de ejemplo — mismos valores que el frame de Figma (Table/RecentPipelines)
// para poder comparar 1:1 sin depender del backend.
const SAMPLE_PIPELINE_ROWS: RecentPipelinesTable2Row[] = [
  { id: '1', name: 'fe-mock-bavv', project: 'Cash', statusLabel: 'Success', statusTone: 'success', duration: '35s' },
  { id: '2', name: 'fe-mock-bavv (stop)', project: 'Cash', statusLabel: 'Failed', statusTone: 'failed', duration: '0s' },
  { id: '3', name: 'fe-mock-bavv', project: 'Cash', statusLabel: 'Failed', statusTone: 'failed', duration: '2m 25s' },
  { id: '4', name: 'fe-mock-bavv (stop)', project: 'Cash', statusLabel: 'Failed', statusTone: 'failed', duration: '0s' },
  { id: '5', name: 'fe-mock-bavv', project: 'Cash', statusLabel: 'Failed', statusTone: 'failed', duration: '2m 2s' },
];

/**
 * Sandbox visual del design system nuevo ("DBoard V1.1.X" de Figma),
 * arrancando por Sidebar2. No está linkeada desde ningún nav — se visita
 * directo por URL para QA mientras se van portando más componentes acá.
 */
export function Sidebar2PreviewPage(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState('dashboard');
  const [railOption, setRailOption] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-screen items-start gap-8 overflow-auto bg-slate-900 p-8">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="absolute top-4 left-4 rounded-full bg-white px-3 py-1 text-xs font-medium text-black"
      >
        {collapsed ? 'Expandir' : 'Colapsar'}
      </button>

      <Sidebar2 collapsed={collapsed} activeId={activeId} onSelect={setActiveId} />

      <div className="flex-1 text-sm text-white/40">
        Sidebar2 — design system preview. activeId: <span className="text-white">{activeId}</span>

        <div className="mt-6 w-[388px]">
          <CardBase>
            <p className="text-[12px] text-white/50">Contenido de ejemplo</p>
          </CardBase>
        </div>

        <div className="mt-10 w-[596px]">
          <p className="mb-2 text-white/40">RecentPipelinesTable2</p>
          <RecentPipelinesTable2 rows={SAMPLE_PIPELINE_ROWS} />
        </div>

        <div className="mt-10 w-[388px]">
          <p className="mb-2 text-white/40">CardProject</p>
          <CardProject
            title="Project Title"
            environments={[
              { name: 'prod', active: true },
              { name: 'staging', active: true },
            ]}
            chatsCount={SAMPLE_RECENT_CHATS.length}
            recentChats={SAMPLE_RECENT_CHATS}
          />
        </div>

        <div className="mt-10 w-[388px]">
          <p className="mb-2 text-white/40">CardProject (sin chats)</p>
          <CardProject title="Project Title" environments={[]} chatsCount={0} recentChats={[]} />
        </div>
      </div>

      <div className="flex h-[809px] flex-col gap-2">
        <p className="text-sm text-white/40">
          ChatOptionsRail — railOption: <span className="text-white">{railOption ?? 'null'}</span>
        </p>
        <ChatOptionsRail activeOption={railOption} onToggleOption={(key) => setRailOption((cur) => (cur === key ? null : key))} />
      </div>
    </div>
  );
}
