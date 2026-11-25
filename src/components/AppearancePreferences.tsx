import { FiGlobe, FiMonitor, FiMoon, FiSun } from 'react-icons/fi';
import { useLabels, useLanguage } from '../store/languageStore';
import type { ThemeMode } from '../store/themeStore';

export function LanguageSelect() {
  const { language, choose } = useLanguage();
  return (
    <select className="language-select" aria-label="语言 / Language" value={language}
      onChange={event => choose(event.target.value === 'en' ? 'en' : 'zh')}>
      <option value="zh" lang="zh-CN">简体中文</option>
      <option value="en" lang="en">English</option>
    </select>
  );
}

export function useThemeOptions(): {
  mode: ThemeMode; label: string; description: string; icon: typeof FiSun;
}[] {
  const t = useLabels();
  return [
    { mode: 'site', label: t('站点默认', 'Site default'), description: t('使用站点设置的配色', 'Use the site theme'), icon: FiGlobe },
    { mode: 'auto', label: t('跟随系统', 'System'), description: t('跟随设备深浅色设置', 'Match your device'), icon: FiMonitor },
    { mode: 'light', label: t('浅色', 'Light'), description: t('始终使用浅色界面', 'Always use light colors'), icon: FiSun },
    { mode: 'dark', label: t('深色', 'Dark'), description: t('始终使用深色界面', 'Always use dark colors'), icon: FiMoon },
  ];
}
