import { useLabels } from '../../store/languageStore';
import { novelLabels } from './novelLabels';
import { useEffect, useState } from 'react';
import type { NovelCatalog, NovelProject } from '../../types/novel';
import { novelAPI } from '../../services/novelApi';
import { errorMessage } from '../Agents/AgentShared';

export default function NovelPreferences({ project, disabled, save }: {
  project: NovelProject; disabled: boolean; save: (changes: Partial<NovelProject>) => void;
}) {
  const t = useLabels();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<NovelCatalog | null>(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(project.settings);
  const [style, setStyle] = useState(project.style);
  const [synopsis, setSynopsis] = useState(project.synopsis);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError('');
    novelAPI.catalog(controller.signal).then(next => {
      if (!controller.signal.aborted) setCatalog(next);
    }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [open]);
  return <details className="novel-card" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t('作品设置', 'Project settings')}</summary>
    {open && <fieldset disabled={disabled || !catalog}>
      {error && <p role="alert">{error}</p>}
      <label>{t('故事灵感', 'Story idea')}<textarea value={synopsis} maxLength={2000} onChange={event => setSynopsis(event.target.value)} /></label>
      <label>{t('文风', 'Style')}<input value={style} maxLength={2000} onChange={event => setStyle(event.target.value)} /></label>
      {([
        ['genre', '题材', catalog?.genres || []], ['audience', '读者', catalog?.options?.audience || ['通用', '男频', '女频']],
        ['perspective', '叙述视角', catalog?.options?.perspective || ['第三人称', '第一人称']],
        ['length', '篇幅', catalog?.options?.length || ['短篇', '中篇', '长篇']], ['textModel', '文本模型', catalog?.models.text || []],
      ] as const).map(([key, label, choices]) => <label key={key}>{t(label, novelLabels[label] || label)}
        <select value={settings[key] || choices[0] || ''} onChange={e => setSettings({ ...settings, [key]: e.target.value })}>
          {settings[key] && !choices.includes(settings[key]) && <option value={settings[key]} disabled>{settings[key]} {t('（不可用）', '(unavailable)')}</option>}
          {choices.map(value => <option key={value} value={value}>{t(value, novelLabels[value] || value)}</option>)}
        </select>
      </label>)}
      <label>{t('单章目标字数', 'Target words per chapter')}<input type="number" value={settings.targetWords} min={800} max={5000}
        onChange={event => setSettings({ ...settings, targetWords: Number(event.target.value) })} /></label>
      <button className="btn btn-primary" type="button" disabled={!catalog?.models.text.length}
        onClick={() => save({ synopsis, style, settings })}>{t('保存作品设置', 'Save project settings')}</button>
    </fieldset>}
  </details>;
}
