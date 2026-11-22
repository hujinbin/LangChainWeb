import { create } from 'zustand';
import { SITE } from '../config/site';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'zhiFlow-theme';

const prefersDark = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const readMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  } catch {
    /* localStorage 不可用时按系统主题 */
  }
  return 'auto';
};

const resolveTheme = (mode: ThemeMode): ResolvedTheme =>
  mode === 'auto' ? (prefersDark() ? 'dark' : 'light') : mode;

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0f1714' : SITE.themeColor);
}

interface ThemeStore {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const useThemeStore = create<ThemeStore>((set) => ({
  mode: readMode(),
  resolved: resolveTheme(readMode()),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* 忽略存储失败 */
    }
    applyTheme(mode);
    set({ mode, resolved: resolveTheme(mode) });
  },
}));

applyTheme(useThemeStore.getState().mode);

if (
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function'
) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', () => {
      if (useThemeStore.getState().mode === 'auto') {
        applyTheme('auto');
        useThemeStore.setState({ resolved: resolveTheme('auto') });
      }
    });
  }
}

export default useThemeStore;
