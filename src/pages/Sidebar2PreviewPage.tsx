import React, { useState } from 'react';
import { Sidebar2 } from '../components/ui/organisms/Sidebar2.js';
import { CardBase } from '../components/ui/atoms/CardBase.js';
import { CardProject } from '../components/ui/molecules/CardProject.js';
import { RecentPipelinesTable2, type RecentPipelinesTable2Row } from '../components/ui/organisms/RecentPipelinesTable2.js';
import { ChatOptionsRail } from '../components/ui/organisms/ChatOptionsRail.js';
import { Topbar } from '../components/ui/organisms/Topbar.js';
import { InfrastructureTable, type InfrastructureTableRow } from '../components/ui/organisms/InfrastructureTable.js';
import { SectionCard } from '../components/ui/molecules/SectionCard.js';
import { Button2 } from '../components/ui/atoms/Button2.js';
import { ButtonIcon, type ButtonIconVariant } from '../components/ui/atoms/ButtonIcon.js';
import { DropdownIcon } from '../components/ui/atoms/DropdownIcon.js';
import { Dropdown, type DropdownOption } from '../components/ui/organisms/Dropdown.js';
import { type DropdownVariant } from '../components/ui/molecules/DropdownTrigger.js';

// Filas de ejemplo — mismos valores que el frame de Figma (Table/Infraestructura).
const SAMPLE_INFRA_ROWS: InfrastructureTableRow[] = [
  { id: '1', project: 'Captudata', activeReplicas: 3, totalReplicas: 5, environments: [{ name: 'prod', active: true }, { name: 'staging', active: true }] },
  { id: '2', project: 'Cash', activeReplicas: 1, totalReplicas: 3, environments: [{ name: 'prod', active: true }] },
  { id: '3', project: 'Jarvis agent', activeReplicas: 2, totalReplicas: 5, environments: [{ name: 'prod', active: true }, { name: 'staging', active: true }] },
  { id: '4', project: 'LX', activeReplicas: 2, totalReplicas: 4, environments: [{ name: 'staging', active: true }] },
  { id: '5', project: 'PLD', activeReplicas: 0, totalReplicas: 3, environments: [{ name: 'prod', active: true }] },
  { id: '6', project: 'Wedding L&C', activeReplicas: 1, totalReplicas: 3, environments: [{ name: 'staging', active: true }] },
];

const BUTTON_ICON_VARIANTS: ButtonIconVariant[] = ['primary', 'tertiary', 'neutral', 'ghost'];

const DROPDOWN_VARIANTS: DropdownVariant[] = ['Secondary', 'Primary', 'Tertiary', 'Neutral'];

const DROPDOWN_OPTIONS: DropdownOption[] = [
  { value: 'valor-cadena', label: 'Valor de cadena', icon: <DropdownIcon icon="house" size={24} /> },
  { value: 'placeholder-1', label: 'Placeholder', icon: <DropdownIcon icon="house" size={24} /> },
  { value: 'placeholder-2', label: 'Placeholder', icon: <DropdownIcon icon="house" size={24} /> },
];

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
  const [dropdownValues, setDropdownValues] = useState<Record<string, string | undefined>>({});

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

      <div className="flex flex-col gap-3">
        <p className="text-sm text-white/40">
          Sidebar2 — variantes de tamaño (sm/md/lg, node 6999:248)
        </p>
        <div className="flex items-start gap-4">
          {(['lg', 'md', 'sm'] as const).map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <span className="text-xs text-white/40">{size}</span>
              <Sidebar2 size={size} activeId={activeId} onSelect={setActiveId} />
            </div>
          ))}
        </div>
      </div>

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

      <div className="flex w-[900px] flex-col gap-6">
        <div>
          <p className="mb-2 text-sm text-white/40">Topbar</p>
          <Topbar title="Dashboard" onMenuClick={() => {}} actions={<Button2 label="+" variant="secondary" size="xs" />} />
        </div>

        <div>
          <p className="mb-2 text-sm text-white/40">Button2</p>
          <div className="flex items-center gap-2">
            <Button2 label="Ver todos" variant="secondary" size="xs" />
            <Button2 label="Nuevo" variant="primary" size="md" />
          </div>
        </div>

        <div className="w-[628px]">
          <p className="mb-2 text-sm text-white/40">SectionCard + InfrastructureTable</p>
          <SectionCard title="Infraestructura">
            <InfrastructureTable rows={SAMPLE_INFRA_ROWS} />
          </SectionCard>
        </div>

        <div>
          <p className="mb-2 text-sm text-white/40">Dropdown</p>
          <div className="flex flex-col gap-4">
            {DROPDOWN_VARIANTS.map((variant) => (
              <div key={variant} className="flex items-center gap-3">
                <span className="w-20 text-xs text-white/40">{variant}</span>
                <div className="w-[257px]">
                  <Dropdown
                    variant={variant}
                    options={DROPDOWN_OPTIONS}
                    value={dropdownValues[variant]}
                    onChange={(dropdownValue) =>
                      setDropdownValues((current) => ({ ...current, [variant]: dropdownValue }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-white/40">ButtonIcon</p>
          <div className="flex flex-col gap-3">
            {BUTTON_ICON_VARIANTS.map((variant) => (
              <div key={variant} className="flex items-center gap-2">
                <span className="w-16 text-xs text-white/40">{variant}</span>
                <ButtonIcon variant={variant} size="lg" />
                <ButtonIcon variant={variant} size="md" />
                <ButtonIcon variant={variant} size="sm" />
                <ButtonIcon variant={variant} size="xs" />
                <ButtonIcon variant={variant} size="md" disabled />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
