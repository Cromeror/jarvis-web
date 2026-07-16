import { useCallback, useState } from 'react';

const STORAGE_PREFIX = 'jarvis:collapsed:';

function readInitial(key: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === '1';
  } catch {
    return false;
  }
}

/**
 * Shared collapse/expand state for side panels (SideNav, file trees, etc.),
 * persisted per `key` in localStorage so the panel stays in the state the
 * user left it across reloads and route changes.
 */
export function useCollapsible(key: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readInitial(key));

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_PREFIX + key, next ? '1' : '0');
      } catch {
        /* best-effort — collapse state just won't persist */
      }
      return next;
    });
  }, [key]);

  return [collapsed, toggle];
}
