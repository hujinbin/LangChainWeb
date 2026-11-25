import { create } from 'zustand';

export type Language = 'zh' | 'en';
export type Labels = (zh: string, en: string) => string;
const chinese: Labels = zh => zh;
const english: Labels = (_, en) => en;
function savedLanguage(): Language {
  try { return localStorage.getItem('zhiFlow-language') === 'en' ? 'en' : 'zh'; }
  catch { return 'zh'; }
}
export const useLanguage = create<{ language: Language; choose: (language: Language) => void }>((set) => ({
  language: savedLanguage(),
  choose: (language) => {
    try { localStorage.setItem('zhiFlow-language', language); } catch { /* private browsing */ }
    if (typeof document !== 'undefined') document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    set({ language });
  }
}));
export function useLabels() {
  const language = useLanguage(state => state.language);
  return language === 'en' ? english : chinese;
}
if (typeof document !== 'undefined') document.documentElement.lang = savedLanguage() === 'zh' ? 'zh-CN' : 'en';
