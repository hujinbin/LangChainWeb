import { create } from 'zustand';
import { DEFAULT_THEME } from '../config/runtime';
import { SITE } from '../config/site';

export type SiteTheme = 'auto' | 'light' | 'dark';
export type ThemeMode = SiteTheme | 'site';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'zhiFlow-theme';
let siteTheme: SiteTheme = DEFAULT_THEME;

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
  return 'site';
};

const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
  const effective = mode === 'site' ? siteTheme : mode;
  return effective === 'auto' ? (prefersDark() ? 'dark' : 'light') : effective;
};

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

export function applySiteTheme(value: unknown) {
  if (value !== 'light' && value !== 'dark' && value !== 'auto') return;
  siteTheme = value;
  if (useThemeStore.getState().mode === 'site') {
    applyTheme('site');
    useThemeStore.setState({ resolved: resolveTheme('site') });
  }
}

if (
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function'
) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', () => {
      const { mode } = useThemeStore.getState();
      if (mode === 'auto' || (mode === 'site' && siteTheme === 'auto')) {
        applyTheme(mode);
        useThemeStore.setState({ resolved: resolveTheme(mode) });
      }
    });
  }
}

export default useThemeStore;
