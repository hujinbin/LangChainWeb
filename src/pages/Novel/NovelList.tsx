import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiBookOpen, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { novelAPI } from '../../services/novelApi';
import type { NovelCatalog, NovelProject } from '../../types/novel';
import { errorMessage, isActive, statusLabel } from '../Agents/AgentShared';
import '../Agents/Agents.css';
import './Novel.css';

const EMPTY_FORM = { name: '', genre: '', chapterCount: 20, targetWords: 2000, textModel: '' };

export default function NovelList(): React.JSX.Element {
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
      setError('请先填写作品名称');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const project = await novelAPI.create({
        name: form.name.trim(),
        genre: form.genre || undefined,
        settings: {
          genre: form.genre || undefined,
          chapterCount: form.chapterCount,
          targetWords: form.targetWords,
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
          <h1>把故事，一章一章写下去。</h1>
          <p>设定类型与篇幅，先生成章节大纲，再逐章续写、润色并导出成书。</p>
        </div>
        <span className="agent-heading-note">
          <i /> TXT · Markdown · DOCX · EPUB
        </span>
      </header>
      {error && (
        <div className="agent-error" role="alert">
          {error}
          <button type="button" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}
      {!loggedIn ? (
        <div className="agent-empty">
          <FiBookOpen />
          <h3>登录后开始你的第一本小说</h3>
          <p>大纲、章节与生成进度都会保存在你的账号空间。</p>
          <Link className="btn btn-primary" to="/login">
            前往登录
          </Link>
        </div>
      ) : (
        <section className="novel-create surface">
          <div className="novel-create-heading">
            <h2>新建作品</h2>
            <p>创建后先生成大纲，确认章节结构再开始写正文。</p>
          </div>
          <form className="novel-create-form" onSubmit={create}>
            <label>
              <span>作品名称</span>
              <input
                value={form.name}
                maxLength={60}
                placeholder="例如：雾港来信"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              <span>小说类型</span>
              <select
                value={form.genre}
                onChange={(event) => setForm({ ...form, genre: event.target.value })}
              >
                {(catalog?.genres || ['都市']).map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>章节数量</span>
              <input
                type="number"
                min={catalog?.agent.limits.minChapters || 3}
                max={catalog?.agent.limits.maxChapters || 200}
                value={form.chapterCount}
                onChange={(event) =>
                  setForm({ ...form, chapterCount: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>单章目标字数</span>
              <input
                type="number"
                min={catalog?.agent.limits.minWords || 300}
                max={catalog?.agent.limits.maxWords || 6000}
                step={100}
                value={form.targetWords}
                onChange={(event) =>
                  setForm({ ...form, targetWords: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>文本模型</span>
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
            <button className="btn btn-primary" type="submit" disabled={creating}>
              <FiPlus /> {creating ? '正在创建…' : '创建作品'}
            </button>
          </form>
        </section>
      )}
      {loggedIn && (
        <section className="agent-project-section" aria-label="我的小说作品">
          <div className="agent-section-heading">
            <div>
              <h2>我的作品</h2>
              <p>{projects.length ? `${projects.length} 本作品，继续上次的章节。` : '还没有作品，先创建一个故事。'}</p>
            </div>
            <button className="btn btn-default" disabled={loading} onClick={() => void load()}>
              <FiRefreshCw /> 刷新
            </button>
          </div>
          {loading && !projects.length ? (
            <div className="agent-empty" role="status">
              正在读取作品…
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
                      {project.genre} · {project.settings.chapterCount} 章
                    </span>
                    <h3>{project.name}</h3>
                    <p>
                      {project.outline?.synopsis ||
                        project.synopsis ||
                        '还没有大纲，进入作品生成章节结构。'}
                    </p>
                    <footer>
                      <span className={isActive(project.job?.status) ? 'agent-live' : ''}>
                        {project.job
                          ? statusLabel(project.job.status)
                          : `${project.doneChapters}/${project.settings.chapterCount} 章`}
                      </span>
                      <time>{project.totalWords} 字</time>
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
                      <span>确认删除《{project.name}》？</span>
                      <button type="button" className="btn btn-default" onClick={() => setDeleting('')}>
                        取消
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={loading}
                        onClick={() => void remove(project.id)}
                      >
                        删除
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
