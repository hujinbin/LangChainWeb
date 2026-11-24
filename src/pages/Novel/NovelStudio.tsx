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
import type { NovelExportFormat, NovelProject } from '../../types/novel';
import { errorMessage, isActive, statusLabel } from '../Agents/AgentShared';
import '../Agents/Agents.css';
import './Novel.css';

const EXPORTS: Array<{ format: NovelExportFormat; label: string }> = [
  { format: 'txt', label: 'TXT' },
  { format: 'md', label: 'Markdown' },
  { format: 'docx', label: 'DOCX' },
  { format: 'epub', label: 'EPUB' },
];

export default function NovelStudio(): React.JSX.Element {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<NovelProject | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const selectedRef = useRef('');
  selectedRef.current = selectedId;
  const active = isActive(project?.job?.status);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const next = await novelAPI.get(id, signal);
        setProject(next);
        setError('');
        const current = next.chapters.find((chapter) => chapter.id === selectedRef.current);
        if (!selectedRef.current && next.chapters.length) {
          setSelectedId(next.chapters[0].id);
          setDraftTitle(next.chapters[0].title);
          setDraftContent(next.chapters[0].content || '');
        } else if (current && current.content && !draftContent) {
          setDraftContent(current.content);
        }
      } catch (failure) {
        if (!signal?.aborted) setError(errorMessage(failure));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id, draftContent],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
    // 只在作品 ID 变化时重新拉取，避免轮询重复触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [active, refresh]);

  const select = (chapterId: string) => {
    const chapter = project?.chapters.find((item) => item.id === chapterId);
    setSelectedId(chapterId);
    setDraftTitle(chapter?.title || '');
    setDraftContent(chapter?.content || '');
    setError('');
  };

  const run = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError('');
    try {
      const next = await action();
      if (next && typeof next === 'object' && 'id' in next) setProject(next as NovelProject);
      else await refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  const saveChapter = async () => {
    if (!project || !selectedId) return;
    setSaving(true);
    setError('');
    try {
      const next = await novelAPI.updateChapter(project.id, selectedId, {
        title: draftTitle,
        content: draftContent,
      });
      setProject(next);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

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
          正在打开作品…
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="agent-page novel-page">
        <div className="agent-empty">
          <FiBookOpen />
          <h3>作品不存在或无权访问</h3>
          <p>{error || '可能已被删除，返回作品列表重新选择。'}</p>
          <Link className="btn btn-primary" to="/novel">
            返回作品列表
          </Link>
        </div>
      </main>
    );
  }

  const selected = project.chapters.find((chapter) => chapter.id === selectedId) || null;

  return (
    <main className="agent-page novel-page">
      <header className="novel-studio-heading">
        <button className="btn btn-default" type="button" onClick={() => navigate('/novel')}>
          <FiArrowLeft /> 作品列表
        </button>
        <div>
          <span className="agent-kicker">
            {project.genre} · {project.settings.chapterCount} 章 · 每章约 {project.settings.targetWords} 字
          </span>
          <h1>{project.name}</h1>
          <p>
            {project.doneChapters}/{project.settings.chapterCount} 章完成 · 共 {project.totalWords} 字
            {project.job ? ` · ${statusLabel(project.job.status)}` : ''}
          </p>
        </div>
        <div className="novel-export">
          {EXPORTS.map((item) => (
            <button
              key={item.format}
              className="btn btn-default"
              type="button"
              disabled={Boolean(exporting) || !project.chapters.some((chapter) => chapter.content)}
              onClick={() => void download(item.format)}
            >
              <FiDownload /> {exporting === item.format ? '导出中…' : item.label}
            </button>
          ))}
        </div>
      </header>
      {error && (
        <div className="agent-error" role="alert">
          {error}
          <button type="button" onClick={() => void refresh()}>
            重试
          </button>
        </div>
      )}
      <div className="novel-grid">
        <aside className="novel-sidebar surface">
          <div className="novel-sidebar-head">
            <h2>章节大纲</h2>
            {active && (
              <button
                className="btn btn-default"
                type="button"
                onClick={() => void run(() => novelAPI.cancel(project.id))}
              >
                <FiSquare /> 取消生成
              </button>
            )}
          </div>
          {!project.outline ? (
            <div className="novel-outline-empty">
              <p>还没有大纲。生成后会得到人物设定与逐章梗概。</p>
              <textarea
                value={instruction}
                rows={3}
                maxLength={2000}
                placeholder="补充要求（可选）：例如双线叙事、每章结尾留悬念…"
                onChange={(event) => setInstruction(event.target.value)}
              />
              <button
                className="btn btn-primary"
                type="button"
                disabled={saving || active}
                onClick={() => void run(() => novelAPI.outline(project.id, instruction))}
              >
                <FiZap /> 生成章节大纲
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
                      onClick={() => select(chapter.id)}
                    >
                      <span>
                        第 {chapter.index + 1} 章 {chapter.title}
                      </span>
                      <small className={chapter.status}>
                        {chapter.status === 'running'
                          ? '生成中'
                          : chapter.status === 'done'
                            ? `${chapter.wordCount} 字`
                            : chapter.status === 'failed'
                              ? '失败'
                              : '待写'}
                      </small>
                    </button>
                  </li>
                ))}
              </ol>
              <button
                className="btn btn-default novel-regenerate-outline"
                type="button"
                disabled={saving || active}
                onClick={() => void run(() => novelAPI.outline(project.id, instruction))}
              >
                <FiRefreshCw /> 重新生成大纲
              </button>
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
                  aria-label="章节标题"
                  onChange={(event) => setDraftTitle(event.target.value)}
                />
                <div>
                  <button
                    className="btn btn-default"
                    type="button"
                    disabled={saving || active}
                    onClick={() => void saveChapter()}
                  >
                    <FiSave /> 保存
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={saving || active}
                    onClick={() =>
                      void run(() =>
                        novelAPI.generateChapter(project.id, selected.id, {
                          instruction,
                          force: Boolean(selected.content),
                        })
                      )
                    }
                  >
                    <FiPlay /> {selected.content ? '重新生成本章' : '生成本章正文'}
                  </button>
                </div>
              </div>
              <p className="novel-chapter-summary">{selected.summary}</p>
              <textarea
                className="novel-content-editor"
                value={draftContent}
                placeholder="点击「生成本章正文」，或直接在这里开始写作。"
                onChange={(event) => setDraftContent(event.target.value)}
              />
              <div className="novel-editor-foot">
                <span>
                  <FiEdit3 /> {draftContent.replace(/\s+/g, '').length} 字
                </span>
                {active && project.job?.chapterId === selected.id && (
                  <span className="agent-live">正在生成，请稍候…</span>
                )}
              </div>
            </>
          ) : (
            <div className="agent-empty">
              <FiBookOpen />
              <h3>选择一个章节</h3>
              <p>从左侧大纲进入章节，生成或编辑正文。</p>
            </div>
          )}
          {project.job && (
            <div className="novel-job">
              <span>{statusLabel(project.job.status)}</span>
              <small>{project.job.error || project.job.stage}</small>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
