import { novelLabels } from './novelLabels';
import { useLabels } from '../../store/languageStore';
import SendToPublisher from '../../components/SendToPublisher';
import { writingDraft } from '../../publishing/resultDrafts';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiBookOpen,
  FiDownload,
  FiEdit3,
  FiPlay,
  FiRefreshCw,
  FiSave,
  FiSquare,
  FiZap,
} from 'react-icons/fi';
import { novelAPI } from '../../services/novelApi';
import NovelPreferences from './NovelPreferences';
import type { NovelExportFormat, NovelMode, NovelProject, NovelSettingCard } from '../../types/novel';
import { errorMessage, isActive, statusLabel } from '../Agents/AgentShared';
import '../Agents/Agents.css';
import './Novel.css';

const EXPORTS: Array<{ format: NovelExportFormat; label: string }> = [
  { format: 'txt', label: 'TXT' },
  { format: 'md', label: 'Markdown' },
  { format: 'docx', label: 'DOCX' },
  { format: 'epub', label: 'EPUB' },
];

const modes: Array<{ value: NovelMode; label: string }> = [
  { value: 'generate', label: '重新生成' }, { value: 'continue', label: '续写' },
  { value: 'expand', label: '扩写' }, { value: 'polish', label: '润色' }, { value: 'rewrite', label: '改写' },
];

function SettingCard({ card, disabled, onSave }: {
  card: NovelSettingCard; disabled: boolean; onSave: (value: NovelSettingCard) => void;
}) {
  const t = useLabels();
  const [draft, setDraft] = useState(card);
  return <details className="novel-card"><summary>{t("人物与故事设定", "Characters and story setting")}</summary>
    <fieldset disabled={disabled}>
      {([['synopsis', t("简介", "Synopsis")], ['worldview', t("世界观", "World")], ['conflict', t("核心冲突", "Central conflict")]] as const).map(([key, label]) =>
        <label key={key}>{label}<textarea value={draft[key] || ''} maxLength={key === 'worldview' ? 4000 : 2000}
          onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
      {draft.characters.map((person, index) => <div className="novel-character" key={index}>
        {([['name', t("姓名", "Name")], ['role', t("角色", "Role")], ['description', t("人物小传", "Character profile")]] as const).map(([key, label]) =>
          <label key={key}>{label}<input value={person[key]} onChange={e => setDraft({
            ...draft, characters: draft.characters.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item),
          })} /></label>)}
        <button type="button" onClick={() => setDraft({ ...draft, characters: draft.characters.filter((_, i) => i !== index) })}>{t("移除人物", "Remove character")}</button>
      </div>)}
      <button className="btn btn-default" disabled={draft.characters.length >= 20} onClick={() => setDraft({ ...draft,
        characters: [...draft.characters, { name: '', role: '', description: '' }] })}>{t("添加人物", "Add character")}</button>
      <button className="btn btn-primary" onClick={() => onSave(draft)}>{t("保存设定", "Save setting")}</button>
    </fieldset>
  </details>;
}

export default function NovelStudio(): React.JSX.Element {
  const { id = '' } = useParams();
  return <Studio key={id} id={id} />;
}

function Studio({ id }: { id: string }): React.JSX.Element {
  const t = useLabels();
  const navigate = useNavigate();
  const [project, setProject] = useState<NovelProject | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftVolume, setDraftVolume] = useState('');
  const [mode, setMode] = useState<NovelMode>('continue');
  const [dirty, setDirty] = useState(false);
  const editVersion = useRef(0);
  const [savingDraft, setSavingDraft] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const selectedRef = useRef('');
  const active = isActive(project?.job?.status);
  const editing = (change: () => void) => {
    editVersion.current++;
    change(); setDirty(true); setError('');
  };

  const adopt = useCallback((next: NovelProject, chapterId = selectedRef.current) => {
    setProject(next);
    const chapter = next.chapters.find(item => item.id === chapterId) || next.chapters[0];
    selectedRef.current = chapter?.id || '';
    setSelectedId(selectedRef.current);
    setDraftTitle(chapter?.title || '');
    setDraftContent(chapter?.content || '');
    setDraftSummary(chapter?.summary || '');
    setDraftVolume(chapter?.volume || '');
    setDirty(false);
  }, []);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const next = await novelAPI.get(id, signal);
        if (signal?.aborted) return;
        adopt(next);
        setError('');
      } catch (failure) {
        if (!signal?.aborted) setError(errorMessage(failure));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id, adopt],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void refresh(controller.signal), 2500);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [active, refresh, project, error]);

  const select = (chapterId: string) => {
    if (project) adopt(project, chapterId);
    setError('');
  };

  const run = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError('');
    try {
      const next = await action();
      if (next && typeof next === 'object' && 'id' in next) adopt(next as NovelProject);
      else await refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  const saveChapter = useCallback(async () => {
    if (!project || !selectedId || !dirty) return;
    const version = editVersion.current;
    setSaving(true);
    setSavingDraft(true);
    setError('');
    try {
      const next = await novelAPI.updateChapter(project.id, selectedId, {
        title: draftTitle,
        content: draftContent, summary: draftSummary, volume: draftVolume, revision: project.revision,
      });
      setProject(next);
      if (version === editVersion.current) setDirty(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
      setSavingDraft(false);
    }
  }, [project, selectedId, dirty, draftTitle, draftContent, draftSummary, draftVolume]);

  useEffect(() => {
    if (!dirty || saving || error || active || !draftTitle.trim()) return;
    const timer = window.setTimeout(() => void saveChapter(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, saving, error, active, draftTitle, saveChapter]);

  const download = async (format: NovelExportFormat) => {
    if (!project) return;
    setExporting(format);
    setError('');
    try {
      await novelAPI.export(project.id, format, project.name || 'novel');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setExporting('');
    }
  };

  if (loading && !project) {
    return (
      <main className="agent-page novel-page">
        <div className="agent-empty" role="status">
          {t("正在打开作品…", "Opening project…")}
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="agent-page novel-page">
        <div className="agent-empty">
          <FiBookOpen />
          <h3>{t("作品不存在或无权访问", "Project unavailable")}</h3>
          <p>{error || t("可能已被删除，返回作品列表重新选择。", "The project may have been deleted. Choose another from the list.")}</p>
          <Link className="btn btn-primary" to="/novel">
            {t("返回作品列表", "Back to projects")}
          </Link>
        </div>
      </main>
    );
  }

  const selected = project.chapters.find((chapter) => chapter.id === selectedId) || null;
  const publishingDraft = selected && !active
    ? writingDraft(draftTitle.trim() || project.name, draftContent, [project.genre])
    : null;

  return (
    <main className="agent-page novel-page">
      <header className="novel-studio-heading">
        <button className="btn btn-default" type="button" disabled={dirty || saving} onClick={() => navigate('/novel')}>
          <FiArrowLeft /> {t("作品列表", "Projects")}
        </button>
        <div>
          <span className="agent-kicker">
            {t(project.genre, novelLabels[project.genre] || project.genre)} · {project.settings.chapterCount} {t("章 · 每章约", "chapters · about")} {project.settings.targetWords} {t("字", "words")}
          </span>
          <h1>{project.name}</h1>
          <p>
            {project.doneChapters}/{project.settings.chapterCount} {t("章完成 · 共", "chapters complete ·")} {project.totalWords} {t("字", "words")}
            {project.job ? ` · ${statusLabel(project.job.status)}` : ''}
          </p>
        </div>
        <div className="novel-export">
          {EXPORTS.map((item) => (
            <button
              key={item.format}
              className="btn btn-default"
              type="button"
              disabled={dirty || saving || Boolean(exporting) || !project.chapters.some((chapter) => chapter.content)}
              onClick={() => void download(item.format)}
            >
              <FiDownload /> {exporting === item.format ? t("导出中…", "Exporting…") : item.label}
            </button>
          ))}
        </div>
      </header>
      <p className="novel-notice">{t("请使用原创或已获授权的素材，并在发布前核对生成内容及人物隐私。", "Use original or licensed material. Review the generated text and check character privacy before publishing.")}</p>
      {error && (
        <div className="agent-error" role="alert">
          {error}
          <button type="button" onClick={() => dirty ? void saveChapter() : void refresh()}>
            {dirty ? t("重试保存", "Retry saving") : t("重试", "Retry")}
          </button>
          {dirty && <button type="button" onClick={() => { if (window.confirm(t("放弃当前未保存的修改并重新读取作品？", "Discard unsaved changes and reload?"))) void refresh(); }}>{t("重新读取", "Reload")}</button>}
        </div>
      )}
      <div className="novel-grid">
        <aside className="novel-sidebar surface">
          <div className="novel-sidebar-head">
            <h2>{t("章节大纲", "Chapter outline")}</h2>
            {active && (
              <button
                className="btn btn-default"
                type="button"
                onClick={() => void run(() => novelAPI.cancel(project.id))}
              >
                <FiSquare /> {t("取消生成", "Cancel generation")}
              </button>
            )}
          </div>
          <NovelPreferences key={JSON.stringify([project.settings, project.style, project.synopsis])}
            project={project} disabled={saving || active || dirty} save={changes => void run(() => novelAPI.update(id, { ...changes, revision: project.revision }))} />
          {project.settingCard && <SettingCard key={JSON.stringify(project.settingCard)} card={project.settingCard} disabled={saving || active || dirty}
            onSave={settingCard => void run(() => novelAPI.update(id, { settingCard, revision: project.revision }))} />}
          <button type="button" className="btn btn-default" disabled={saving || active || dirty}
            onClick={() => void run(() => novelAPI.outline(id, instruction, 'setting', project.revision))}>
            {project.settingCard ? t("重新生成设定卡", "Regenerate setting") : t("生成设定卡", "Generate setting")}
          </button>
          {!project.outline ? (
            <div className="novel-outline-empty">
              <p>{t("还没有大纲。生成后会得到人物设定与逐章梗概。", "Generate an outline to see characters and chapter summaries.")}</p>
              <textarea
                value={instruction}
                rows={3}
                maxLength={2000}
                placeholder={t("补充要求（可选）：例如双线叙事、每章结尾留悬念…", "Optional guidance, such as parallel plots or cliffhanger endings…")}
                onChange={(event) => setInstruction(event.target.value)}
              />
              <button
                className="btn btn-primary"
                type="button"
                disabled={saving || active}
                onClick={() => void run(() => novelAPI.outline(project.id, instruction, 'outline', project.revision))}
              >
                <FiZap /> {t("生成章节大纲", "Generate outline")}
              </button>
            </div>
          ) : (
            <>
              <div className="novel-outline-meta">
                <p>{project.outline.synopsis}</p>
                {project.outline.worldview && <small>{project.outline.worldview}</small>}
              </div>
              <ol className="novel-chapter-list">
                {project.chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      className={chapter.id === selectedId ? 'active' : ''}
                      disabled={dirty || saving}
                      onClick={() => select(chapter.id)}
                    >
                      <span>
                        {t("第", "Chapter")} {chapter.index + 1} {t("章", "")} {chapter.title}
                      </span>
                      <small className={chapter.status}>
                        {chapter.status === 'running'
                          ? t("生成中", "Generating")
                          : chapter.status === 'done'
                            ? `${chapter.wordCount} 字`
                            : chapter.status === 'failed'
                              ? t("失败", "Failed")
                              : t("待写", "Unwritten")}
                      </small>
                    </button>
                  </li>
                ))}
              </ol>
              {selected && <div className="novel-order" aria-label={t("调整章节", "Arrange chapters")}>
                {([{ value: 'up', label: t("上移", "Move up"), disabled: selected.index === 0 }, { value: 'down', label: t("下移", "Move down"), disabled: selected.index === project.chapters.length - 1 },
                  { value: 'add', label: t("插入章节", "Insert chapter"), disabled: project.chapters.length >= 100 }, { value: 'remove', label: t("删除章节", "Delete chapter"), disabled: project.chapters.length <= 1 }] as const)
                  .map(({ value, label, disabled }) => <button type="button" key={value} className="btn btn-default" disabled={saving || active || dirty || disabled}
                    onClick={() => {
                      if (value === 'remove' && !window.confirm(`删除《${selected.title}》及其正文？`)) return;
                      void run(() => novelAPI.update(id, { chapterEdit: { chapterId: selected.id, action: value }, revision: project.revision }));
                    }}>{label}</button>)}
              </div>}
              <button
                className="btn btn-default novel-regenerate-outline"
                type="button"
                disabled={saving || active || dirty}
                onClick={() => void run(() => novelAPI.outline(project.id, instruction, 'outline', project.revision))}
              >
                <FiRefreshCw /> {t("重新生成大纲", "Regenerate outline")}
              </button>
              {Boolean(project.outlineHistory?.length) && <details className="novel-history"><summary>{t("历史大纲", "Outline history")}</summary>
                {project.outlineHistory?.slice().reverse().map(entry => <details key={entry.savedAt}>
                  <summary>{new Date(entry.savedAt).toLocaleString()}</summary><p>{entry.outline.synopsis}</p>
                  {entry.outline.chapters.map(chapter => <p key={chapter.id}>{chapter.title} · {chapter.summary}</p>)}
                </details>)}
              </details>}
            </>
          )}
        </aside>
        <section className="novel-editor surface">
          {selected ? (
            <>
              <div className="novel-editor-head">
                <input
                  className="novel-title-input"
                  value={draftTitle}
                  maxLength={80}
                  aria-label={t("章节标题", "Chapter title")}
                  disabled={(saving && !savingDraft) || active}
                  onChange={(event) => editing(() => setDraftTitle(event.target.value))}
                />
                <div>
                  <button
                    className="btn btn-default"
                    type="button"
                    disabled={saving || active || !dirty}
                    onClick={() => void saveChapter()}
                  >
                    <FiSave /> {t("保存", "Save")}
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={saving || active || dirty}
                    onClick={() =>
                      void run(() =>
                        novelAPI.generateChapter(project.id, selected.id, {
                          instruction,
                          force: Boolean(selected.content),
                          mode: selected.content ? mode : 'generate',
                          revision: project.revision,
                        })
                      )
                    }
                  >
                    <FiPlay /> {selected.content ? t((modes.find(item => item.value === mode)?.label || '') + '本章', mode.charAt(0).toUpperCase() + mode.slice(1) + ' this chapter') : t("生成本章正文", "Generate chapter text")}
                  </button>
                </div>
              </div>
              <fieldset className="novel-chapter-options" disabled={(saving && !savingDraft) || active}>
                <label>{t("分卷", "Volume")}<input value={draftVolume} maxLength={80} onChange={e => editing(() => setDraftVolume(e.target.value))} /></label>
                <label>{t("本章细纲", "Chapter plan")}<textarea value={draftSummary} maxLength={600} onChange={e => editing(() => setDraftSummary(e.target.value))} /></label>
                {selected.content && <label>{t("编辑方式", "Editing mode")}<select value={mode} onChange={e => setMode(e.target.value as NovelMode)}>
                  {modes.map(item => <option key={item.value} value={item.value}>{t(item.label, novelLabels[item.label] || item.label)}</option>)}
                </select></label>}
                <label>{t("生成要求", "Generation instructions")}<input maxLength={2000} placeholder={t("可选，例如保留结尾对白", "Optional, for example, keep the final dialogue")} value={instruction} onChange={e => setInstruction(e.target.value)} /></label>
              </fieldset>
              <textarea
                className="novel-content-editor"
                value={draftContent}
                placeholder={t("点击「生成本章正文」，或直接在这里开始写作。", "Generate a chapter or start writing here.")}
                aria-label={t("章节正文", "Chapter text")} maxLength={200000} disabled={(saving && !savingDraft) || active}
                onChange={(event) => editing(() => setDraftContent(event.target.value))}
              />
              <div className="novel-editor-foot">
                {publishingDraft && <SendToPublisher draft={publishingDraft} />}
                <span>
                  <FiEdit3 /> {draftContent.replace(/\s+/g, '').length} {t("字", "words")}
                  {saving ? t(" · 处理中", " · Working") : dirty ? t(" · 待保存", " · Unsaved") : ''}
                </span>
                {active && project.job?.chapterId === selected.id && (
                  <span className="agent-live">{t("正在生成，请稍候…", "Generating, please wait…")}</span>
                )}
              </div>
            </>
          ) : (
            <div className="agent-empty">
              <FiBookOpen />
              <h3>{t("选择一个章节", "Choose a chapter")}</h3>
              <p>{t("从左侧大纲进入章节，生成或编辑正文。", "Select a chapter in the outline to generate or edit its text.")}</p>
            </div>
          )}
          {project.job && (
            <div className="novel-job">
              <span>{statusLabel(project.job.status)}</span>
              <small>{project.job.error || project.job.stage}</small>
              {project.job.billing?.status === 'settled' && <small>{project.job.billing.pointsCharged} {t("积分 ·", "credits ·")} {project.job.billing.totalTokens ?? '—'} Token</small>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
