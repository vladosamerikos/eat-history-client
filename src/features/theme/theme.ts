import { useEffect, useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'eh_theme';
let current: ThemeMode = (typeof localStorage !== 'undefined'
  ? (localStorage.getItem(KEY) as ThemeMode | null)
  : null) ?? 'system';

const listeners = new Set<() => void>();
function emit(): void {
  listeners.forEach((l) => l());
}

function subscribeToTheme(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ThemeMode {
  return current;
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

export function setTheme(mode: ThemeMode): void {
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // ignored
  }
  applyTheme(mode);
  emit();
}

export function useTheme(): { mode: ThemeMode; setMode: (m: ThemeMode) => void; resolved: 'light' | 'dark' } {
  const mode = useSyncExternalStore(subscribeToTheme, getSnapshot, getSnapshot);
  useEffect(() => {
    if (mode !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);
  const resolved: 'light' | 'dark' =
    mode === 'dark' || (mode === 'system' && systemPrefersDark()) ? 'dark' : 'light';
  return { mode, setMode: setTheme, resolved };
}

export function initTheme(): void {
  applyTheme(current);
}
