import { novelLabels } from './novelLabels';
import { useLabels } from '../../store/languageStore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiBookOpen, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { novelAPI } from '../../services/novelApi';
import type { NovelCatalog, NovelProject } from '../../types/novel';
import { errorMessage, isActive, statusLabel } from '../Agents/AgentShared';
import '../Agents/Agents.css';
import './Novel.css';

const EMPTY_FORM = { name: '', synopsis: '', style: '简洁', genre: '', audience: '通用', perspective: '第三人称', length: '短篇', chapterCount: 10, targetWords: 2000, textModel: '' };
const preferences = [
  { key: 'audience', label: '读者', choices: ['通用', '男频', '女频'] },
  { key: 'perspective', label: '叙述视角', choices: ['第三人称', '第一人称'] },
  { key: 'length', label: '篇幅', choices: ['短篇', '中篇', '长篇'] },
] as const;

export default function NovelList(): React.JSX.Element {
  const t = useLabels();
  const navigate = useNavigate();
  const loggedIn = useAuthStore((state) => state.isLoggedIn);
  const [catalog, setCatalog] = useState<NovelCatalog | null>(null);
  const [projects, setProjects] = useState<NovelProject[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string>('');
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!loggedIn) return;
      const version = ++requestVersion.current;
      setLoading(true);
      setError('');
      try {
        const [available, list] = await Promise.all([
          novelAPI.catalog(signal),
          novelAPI.list(1, signal),
        ]);
        if (signal?.aborted || version !== requestVersion.current) return;
        setCatalog(available);
        setProjects(list.items);
        setForm((current) => ({
          ...current,
          genre: current.genre || available.defaults.genre,
          chapterCount: current.chapterCount || available.defaults.chapterCount,
          targetWords: current.targetWords || available.defaults.targetWords,
          textModel: current.textModel || available.defaults.textModel,
        }));
      } catch (failure) {
        if (!signal?.aborted && version === requestVersion.current)
          setError(errorMessage(failure));
      } finally {
        if (!signal?.aborted && version === requestVersion.current) setLoading(false);
      }
    },
    [loggedIn],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loggedIn) {
      navigate('/login');
      return;
    }
    if (!form.name.trim()) {
      setError(t("请先填写作品名称", "Enter a title first"));
      return;
    }
    setCreating(true);
    setError('');
    try {
      const project = await novelAPI.create({
        name: form.name.trim(),
        synopsis: form.synopsis.trim(),
        style: form.style.trim(),
        genre: form.genre || undefined,
        settings: {
          genre: form.genre || undefined,
          chapterCount: form.chapterCount,
          targetWords: form.targetWords,
          audience: form.audience, perspective: form.perspective, length: form.length,
          textModel: form.textModel || undefined,
        },
      });
      navigate(`/novel/${project.id}`);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      await novelAPI.remove(id);
      setDeleting('');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
      setLoading(false);
    }
  };

  return (
    <main className="agent-page novel-page">
      <header className="agent-page-heading">
        <div>
          <div className="agent-eyebrow">NOVEL STUDIO</div>
          <h1>{t("把故事，一章一章写下去。", "Write your story, one chapter at a time.")}</h1>
          <p>{t("设定类型与篇幅，先生成章节大纲，再逐章续写、润色并导出成书。", "Choose a genre and length, generate an outline and write, revise and export your chapters.")}</p>
        </div>
        <span className="agent-heading-note">
          <i /> TXT · Markdown · DOCX · EPUB
        </span>
      </header>
      {error && (
        <div className="agent-error" role="alert">
          {error}
          <button type="button" onClick={() => void load()}>
            {t("重试", "Retry")}
          </button>
        </div>
      )}
      {!loggedIn ? (
        <div className="agent-empty">
          <FiBookOpen />
          <h3>{t("登录后开始你的第一本小说", "Sign in to start your first novel")}</h3>
          <p>{t("大纲、章节与生成进度都会保存在你的账号空间。", "Your account stores outlines, chapters and generation progress.")}</p>
          <Link className="btn btn-primary" to="/login">
            {t("前往登录", "Sign in")}
          </Link>
        </div>
      ) : (
        <section className="novel-create surface">
          <div className="novel-create-heading">
            <h2>{t("新建作品", "New novel")}</h2>
            <p>{t("创建后先生成大纲，确认章节结构再开始写正文。", "Generate an outline and review its chapters before writing.")}</p>
          </div>
          <form className="novel-create-form" onSubmit={create}>
            <label>
              <span>{t("作品名称", "Title")}</span>
              <input
                value={form.name}
                maxLength={60}
                placeholder={t("例如：雾港来信", "For example, Letters from Mist Harbor")}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="novel-inspiration">
              <span>{t("一句话灵感", "Story idea")}</span>
              <input value={form.synopsis} maxLength={2000} placeholder={t("一封迟到二十年的信，让雾港的邮递员重新出发。", "A letter delayed by twenty years sends a harbor postman on a new journey.")}
                onChange={event => setForm({ ...form, synopsis: event.target.value })} />
            </label>
            {preferences.map(({ key, label, choices }) => <label key={key}>
              <span>{t(label, novelLabels[label] || label)}</span><select value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })}>
                {(catalog?.options?.[key] || choices).map(choice => <option key={choice} value={choice}>{t(choice, novelLabels[choice] || choice)}</option>)}
              </select>
            </label>)}
            <label>
              <span>{t("文风", "Style")}</span><input value={form.style} maxLength={2000} onChange={event => setForm({ ...form, style: event.target.value })} />
            </label>
            <label>
              <span>{t("小说类型", "Genre")}</span>
              <select
                value={form.genre}
                onChange={(event) => setForm({ ...form, genre: event.target.value })}
              >
                {(catalog?.genres || ['都市']).map((genre) => (
                  <option key={genre} value={genre}>
                    {t(genre, novelLabels[genre] || genre)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("章节数量", "Chapters")}</span>
              <input
                type="number"
                min={catalog?.agent.limits.minChapters || 1}
                max={catalog?.agent.limits.maxChapters || 100}
                value={form.chapterCount}
                onChange={(event) =>
                  setForm({ ...form, chapterCount: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>{t("单章目标字数", "Target words per chapter")}</span>
              <input
                type="number"
                min={catalog?.agent.limits.minWords || 800}
                max={catalog?.agent.limits.maxWords || 5000}
                value={form.targetWords}
                onChange={(event) =>
                  setForm({ ...form, targetWords: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>{t("文本模型", "Text model")}</span>
              <select
                value={form.textModel}
                onChange={(event) => setForm({ ...form, textModel: event.target.value })}
              >
                {(catalog?.models.text || []).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit" disabled={creating || !catalog?.models.text.length}>
              <FiPlus /> {creating ? t("正在创建…", "Creating…") : t("创建作品", "Create novel")}
            </button>
          </form>
          {catalog && !catalog.models.text.length && <p role="status">{t("本站暂无可用文本模型。", "No text models are available for this site.")}</p>}
        </section>
      )}
      {loggedIn && (
        <section className="agent-project-section" aria-label={t("我的小说作品", "My novels")}>
          <div className="agent-section-heading">
            <div>
              <h2>{t("我的作品", "My projects")}</h2>
              <p>{projects.length ? `${projects.length} 本作品，继续上次的章节。` : t("还没有作品，先创建一个故事。", "Create your first story.")}</p>
            </div>
            <button className="btn btn-default" disabled={loading} onClick={() => void load()}>
              <FiRefreshCw /> {t("刷新", "Refresh")}
            </button>
          </div>
          {loading && !projects.length ? (
            <div className="agent-empty" role="status">
              {t("正在读取作品…", "Loading novels…")}
            </div>
          ) : (
            <div className="agent-project-grid">
              {projects.map((project) => (
                <article className="agent-project-card novel-project-card" key={project.id}>
                  <Link to={`/novel/${project.id}`} className="agent-project-main">
                    <span className="agent-mini-icon novel">
                      <FiBookOpen />
                    </span>
                    <span className="agent-kicker">
                      {t(project.genre, novelLabels[project.genre] || project.genre)} · {project.settings.chapterCount} {t("章", "chapters")}
                    </span>
                    <h3>{project.name}</h3>
                    <p>
                      {project.outline?.synopsis ||
                        project.synopsis ||
                        t("还没有大纲，进入作品生成章节结构。", "Generate an outline to start planning chapters.")}
                    </p>
                    <footer>
                      <span className={isActive(project.job?.status) ? 'agent-live' : ''}>
                        {project.job
                          ? statusLabel(project.job.status)
                          : `${project.doneChapters}/${project.settings.chapterCount} 章`}
                      </span>
                      <time>{project.totalWords} {t("字", "words")}</time>
                    </footer>
                  </Link>
                  <button
                    type="button"
                    className="agent-delete"
                    aria-label={`删除${project.name}`}
                    disabled={isActive(project.job?.status)}
                    onClick={() => setDeleting(project.id)}
                  >
                    <FiTrash2 />
                  </button>
                  {deleting === project.id && (
                    <div className="novel-delete-confirm">
                      <span>{t("确认删除《", "Delete “")}{project.name}》？</span>
                      <button type="button" className="btn btn-default" onClick={() => setDeleting('')}>
                        {t("取消", "Cancel")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={loading}
                        onClick={() => void remove(project.id)}
                      >
                        {t("删除", "Delete")}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
