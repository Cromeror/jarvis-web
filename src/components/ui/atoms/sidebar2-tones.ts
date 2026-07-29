export type Sidebar2Tone = 'default' | 'active' | 'accent';

export const SIDEBAR2_TONE_BG_CLASS: Record<Sidebar2Tone, string> = {
  default: 'bg-transparent hover:bg-white/10',
  active: 'bg-[var(--sidebar2-item-active-bg)]',
  accent: 'bg-[var(--sidebar2-accent-default)]',
};

export const SIDEBAR2_TONE_TEXT_CLASS: Record<Sidebar2Tone, string> = {
  default: 'text-[var(--sidebar2-item-text-default)]',
  active: 'text-[var(--sidebar2-item-text-active)]',
  accent: 'text-[var(--sidebar2-item-icon-on-accent)]',
};

export const SIDEBAR2_TONE_ICON_CLASS: Record<Sidebar2Tone, string> = {
  default: 'text-[var(--sidebar2-item-icon-default)]',
  active: 'text-[var(--sidebar2-item-icon-active)]',
  accent: 'text-[var(--sidebar2-item-icon-on-accent)]',
};
