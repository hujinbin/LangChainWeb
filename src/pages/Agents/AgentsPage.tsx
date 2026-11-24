import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiArrowUpRight,
  FiBookOpen,
  FiCloud,
  FiFilm,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { agentAPI } from '../../services/agentApi';
import type { AgentCatalog, AgentKind, AgentProject } from '../../types/agent';
import {
  AgentArtwork,
  errorMessage,
  isActive,
  statusLabel,
} from './AgentShared';
import { KnowledgeModal } from '../KnowledgeBase/KnowledgeBaseShared';
import '../KnowledgeBase/KnowledgeBase.css';
import './Agents.css';
import CustomAgentList from '../CustomAgents/CustomAgentList';

export default function AgentsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const loggedIn = useAuthStore((state) => state.isLoggedIn);
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null);
  const [projects, setProjects] = useState<AgentProject[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<AgentKind | null>(null);
  const [deleting, setDeleting] = useState<AgentProject | null>(null);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++requestVersion.current;
      if (!loggedIn) return;
      setLoading(true);
      setError('');
      try {
        const [available, list] = await Promise.all([
          agentAPI.catalog(signal),
          agentAPI.list(page, signal),
        ]);
        if (signal?.aborted || version !== requestVersion.current) return;
        setCatalog(available);
        setProjects(list.items);
        setTotal(list.total);
      } catch (failure) {
        if (!signal?.aborted && version === requestVersion.current)
          setError(errorMessage(failure));
      } finally {
        if (!signal?.aborted && version === requestVersion.current)
          setLoading(false);
      }
    },
    [loggedIn, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const create = async (kind: AgentKind) => {
    if (!loggedIn) {
      navigate('/login');
      return;
    }
    setCreating(kind);
    setError('');
    try {
      const project = await agentAPI.create(kind);
      navigate(`/agents/${project.id}`);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setCreating(null);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setLoading(true);
    setError('');
    try {
      await agentAPI.delete(deleting.id);
      setDeleting(null);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
      setLoading(false);
    }
  };
  return (
    <main className="agent-page">
      <header className="agent-page-heading">
        <div>
          <div className="agent-eyebrow">CREATIVE AGENTS</div>
          <h1>让灵感，成为作品。</h1>
          <p>把创作交给智能体，把每一个重要的决定留给你。</p>
        </div>
        <span className="agent-heading-note">
          <i /> 从想法到分镜，再到成品
        </span>
      </header>
      {error && !deleting && (
        <div className="agent-error" role="alert">
          {error}
          <button type="button" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}
      <CustomAgentList />
      <section className="agent-presets" aria-label="选择创作智能体">
        <article className="agent-preset comic">
          <AgentArtwork kind="comic" />
          <div className="agent-preset-body">
            <span className="agent-kicker">
              <FiCloud /> 图文创作智能体
            </span>
            <h2>云朵漫画</h2>
            <p>
              让一只小云朵，替你说出生活里的那些小情绪。原创角色、连续分镜，组成一个温暖的小故事。
            </p>
            <div className="agent-tags">
              <span>原创角色</span>
              <span>3–5 格漫画</span>
              <span>可编辑分镜</span>
            </div>
            <button
              className="btn btn-primary"
              type="button"
              disabled={creating !== null}
              onClick={() => void create('cloud-comic')}
            >
              {creating === 'cloud-comic' ? '正在创建…' : '开始画一个故事'}
              <FiArrowUpRight />
            </button>
          </div>
        </article>
        <article className="agent-preset life">
          <AgentArtwork kind="life" />
          <div className="agent-preset-body">
            <span className="agent-kicker">
              <FiFilm /> 视频创作智能体
            </span>
            <h2>人生副本</h2>
            <p>
              选一个身份，走过一段人生。将命运的起伏写成分镜，再把每个阶段拍成连续的影像。
            </p>
            <div className="agent-tags">
              <span>人生叙事</span>
              <span>连续视频分镜</span>
              <span>字幕合成</span>
            </div>
            <button
              className="btn btn-primary"
              type="button"
              disabled={creating !== null}
              onClick={() => void create('life-story')}
            >
              {creating === 'life-story' ? '正在创建…' : '开启一段人生'}
              <FiArrowUpRight />
            </button>
          </div>
        </article>
        <article className="agent-preset novel">
          <span className="agent-preset-novel-art" aria-hidden="true">
            <FiBookOpen />
          </span>
          <div className="agent-preset-body">
            <span className="agent-kicker">
              <FiBookOpen /> 小说创作智能体
            </span>
            <h2>小说工坊</h2>
            <p>
              设定类型与篇幅，生成人物和章节大纲，再逐章续写。完成后可导出 TXT、Markdown、DOCX 或 EPUB。
            </p>
            <div className="agent-tags">
              <span>章节大纲</span>
              <span>逐章续写</span>
              <span>四种导出格式</span>
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate('/novel')}
            >
              进入小说工坊
              <FiArrowUpRight />
            </button>
          </div>
        </article>
      </section>
      <section className="agent-project-section" aria-label="我的智能体作品">
        <div className="agent-section-heading">
          <div>
            <h2>我的创作</h2>
            <p>
              {total === null
                ? '每个想法，都有自己的工作室。'
                : `${total} 个创作项目，随时回来继续。`}
            </p>
          </div>
          {loggedIn && (
            <button
              className="btn btn-default"
              disabled={loading}
              onClick={() => void load()}
            >
              <FiRefreshCw /> 刷新
            </button>
          )}
        </div>
        {!loggedIn ? (
          <div className="agent-empty">
            <FiPlus />
            <h3>登录后，开始你的第一件作品</h3>
            <p>保存分镜、查看生成进度，随时回来接着创作。</p>
            <Link className="btn btn-primary" to="/login">
              前往登录
            </Link>
          </div>
        ) : loading && !projects.length ? (
          <div className="agent-empty" role="status">
            正在读取作品…
          </div>
        ) : !projects.length && !error ? (
          <div className="agent-empty">
            <FiPlus />
            <h3>这里等着你的第一个故事</h3>
            <p>选择上方的智能体，输入一个主题即可开始。</p>
          </div>
        ) : (
          <div className="agent-project-grid">
            {projects.map((project) => (
              <article className="agent-project-card" key={project.id}>
                <Link
                  to={`/agents/${project.id}`}
                  className="agent-project-main"
                >
                  <span
                    className={`agent-mini-icon ${project.agentId === 'cloud-comic' ? 'comic' : 'life'}`}
                  >
                    {project.agentId === 'cloud-comic' ? (
                      <FiCloud />
                    ) : (
                      <FiFilm />
                    )}
                  </span>
                  <span className="agent-kicker">
                    {project.agentId === 'cloud-comic'
                      ? '云朵漫画'
                      : '人生副本'}
                  </span>
                  <h3>{project.name}</h3>
                  <p>
                    {project.draft?.summary ||
                      project.brief ||
                      '创作还在酝酿，进来写下第一个想法。'}
                  </p>
                  <footer>
                    <span
                      className={
                        isActive(project.job?.status) ? 'agent-live' : ''
                      }
                    >
                      {project.job ? statusLabel(project.job.status) : '草稿'}
                    </span>
                    <time>
                      {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
                    </time>
                    <FiArrowUpRight />
                  </footer>
                </Link>
                <button
                  type="button"
                  className="agent-delete"
                  aria-label={`删除${project.name}`}
                  disabled={isActive(project.job?.status)}
                  onClick={() => {
                    setError('');
                    setDeleting(project);
                  }}
                >
                  <FiTrash2 />
                </button>
              </article>
            ))}
          </div>
        )}
        {loggedIn && total !== null && total > 20 && (
          <div className="agent-pagination">
            <button
              className="btn btn-default"
              disabled={page === 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              上一页
            </button>
            <span>第 {page} 页</span>
            <button
              className="btn btn-default"
              disabled={page * 20 >= total || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              下一页
            </button>
          </div>
        )}
      </section>
      {deleting && (
        <KnowledgeModal
          title="删除这个创作项目？"
          onClose={() => setDeleting(null)}
          busy={loading}
        >
          <p className="agent-delete-description">
            “{deleting.name}”的分镜和生成素材将被清理。
          </p>
          {error && (
            <p className="agent-error" role="alert">
              {error}
            </p>
          )}
          <div className="agent-delete-actions">
            <button
              className="btn btn-default"
              disabled={loading}
              onClick={() => setDeleting(null)}
            >
              保留作品
            </button>
            <button
              className="btn btn-primary"
              disabled={loading}
              onClick={() => void remove()}
            >
              确认删除
            </button>
          </div>
        </KnowledgeModal>
      )}
      {catalog && (
        <span className="agent-screenreader">
          已连接 {catalog.agents.length} 个创作智能体
        </span>
      )}
    </main>
  );
}
