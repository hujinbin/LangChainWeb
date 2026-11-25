import { useLabels } from '../../store/languageStore';
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
  const t = useLabels();
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
  const [importing, setImporting] = useState('');
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
          <h1>{t("让灵感，成为作品。", "Turn ideas into stories.")}</h1>
          <p>{t("把创作交给智能体，把每一个重要的决定留给你。", "Choose an agent to create a comic, a life story or a novel.")}</p>
        </div>
        <span className="agent-heading-note">
          <i /> {t("从想法到分镜，再到成品", "From idea to storyboard to final work")}
        </span>
      </header>
      {error && !deleting && (
        <div className="agent-error" role="alert">
          {error}
          <button type="button" onClick={() => void load()}>
            {t("重试", "Retry")}
          </button>
        </div>
      )}
      <CustomAgentList />
      {Boolean(catalog?.templates?.length) && loggedIn && <section className="agent-project-section" aria-label={t("智能体模板市场", "Agent template library")}>
        <div className="agent-section-heading"><div><h2>{t("模板市场", "Template library")}</h2><p>{t("将模板导入为自己的草稿，然后编辑创作要求或客服人设。", "Import a template to edit its creative brief or support persona.")}</p></div></div>
        <div className="agent-project-grid">{catalog?.templates?.map(template => <article key={template.id} className="agent-project-card">
          <div className="agent-project-main"><h3>{template.title}</h3><p>{template.description}</p>
            <button className="btn btn-default" disabled={Boolean(importing)} onClick={async () => {
              setImporting(template.id); setError('');
              try {
                const draft = await agentAPI.importTemplate(template.id);
                const base = draft.kind === 'novel' ? '/novel' : draft.kind === 'custom' ? '/agents/custom' : '/agents';
                navigate(`${base}/${draft.id}`);
              } catch (failure) { setError(errorMessage(failure)); } finally { setImporting(''); }
            }}><FiPlus />{importing === template.id ? t("正在导入…", "Importing…") : t("导入模板", "Import template")}</button>
          </div>
        </article>)}</div>
      </section>}
      <section className="agent-presets" aria-label={t("选择创作智能体", "Choose an agent")}>
        <article className="agent-preset comic">
          <AgentArtwork kind="comic" />
          <div className="agent-preset-body">
            <span className="agent-kicker">
              <FiCloud /> {t("图文创作智能体", "Comic agent")}
            </span>
            <h2>{t("云朵漫画", "Cloud Comic")}</h2>
            <p>
              {t("让一只小云朵，替你说出生活里的那些小情绪。原创角色、连续分镜，组成一个温暖的小故事。", "Turn everyday emotions into a short story with original characters and connected panels.")}
            </p>
            <div className="agent-tags">
              <span>{t("原创角色", "Original characters")}</span>
              <span>{t("3–5 格漫画", "3–5 panels")}</span>
              <span>{t("可编辑分镜", "Editable storyboard")}</span>
            </div>
            <button
              className="btn btn-primary"
              type="button"
              disabled={creating !== null}
              onClick={() => void create('cloud-comic')}
            >
              {creating === 'cloud-comic' ? t("正在创建…", "Creating…") : t("开始画一个故事", "Start a comic")}
              <FiArrowUpRight />
            </button>
          </div>
        </article>
        <article className="agent-preset life">
          <AgentArtwork kind="life" />
          <div className="agent-preset-body">
            <span className="agent-kicker">
              <FiFilm /> {t("视频创作智能体", "Video agent")}
            </span>
            <h2>{t("人生副本", "Life Story")}</h2>
            <p>
              {t("选一个身份，走过一段人生。将命运的起伏写成分镜，再把每个阶段拍成连续的影像。", "Choose a character and turn the stages of their life into a continuous sequence of videos.")}
            </p>
            <div className="agent-tags">
              <span>{t("人生叙事", "Life narrative")}</span>
              <span>{t("连续视频分镜", "Video storyboard")}</span>
              <span>{t("字幕合成", "Subtitle composition")}</span>
            </div>
            <button
              className="btn btn-primary"
              type="button"
              disabled={creating !== null}
              onClick={() => void create('life-story')}
            >
              {creating === 'life-story' ? t("正在创建…", "Creating…") : t("开启一段人生", "Start a life story")}
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
              <FiBookOpen /> {t("小说创作智能体", "Novel agent")}
            </span>
            <h2>{t("小说工坊", "Novel studio")}</h2>
            <p>
              {t("设定类型与篇幅，生成人物和章节大纲，再逐章续写。完成后可导出 TXT、Markdown、DOCX 或 EPUB。", "Choose a genre and length, develop characters and chapters, then export to TXT, Markdown, DOCX or EPUB.")}
            </p>
            <div className="agent-tags">
              <span>{t("章节大纲", "Chapter outline")}</span>
              <span>{t("逐章续写", "Chapter writing")}</span>
              <span>{t("四种导出格式", "Four export formats")}</span>
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate('/novel')}
            >
              {t("进入小说工坊", "Open novel studio")}
              <FiArrowUpRight />
            </button>
          </div>
        </article>
      </section>
      <section className="agent-project-section" aria-label={t("我的智能体作品", "My agent projects")}>
        <div className="agent-section-heading">
          <div>
            <h2>{t("我的创作", "My projects")}</h2>
            <p>
              {total === null
                ? t("每个想法，都有自己的工作室。", "Return to any project to continue editing.")
                : `${total} 个创作项目，随时回来继续。`}
            </p>
          </div>
          {loggedIn && (
            <button
              className="btn btn-default"
              disabled={loading}
              onClick={() => void load()}
            >
              <FiRefreshCw /> {t("刷新", "Refresh")}
            </button>
          )}
        </div>
        {!loggedIn ? (
          <div className="agent-empty">
            <FiPlus />
            <h3>{t("登录后，开始你的第一件作品", "Sign in to start your first project")}</h3>
            <p>{t("保存分镜、查看生成进度，随时回来接着创作。", "Save storyboards, check generation progress and resume later.")}</p>
            <Link className="btn btn-primary" to="/login">
              {t("前往登录", "Sign in")}
            </Link>
          </div>
        ) : loading && !projects.length ? (
          <div className="agent-empty" role="status">
            {t("正在读取作品…", "Loading projects…")}
          </div>
        ) : !projects.length && !error ? (
          <div className="agent-empty">
            <FiPlus />
            <h3>{t("这里等着你的第一个故事", "Create your first story")}</h3>
            <p>{t("选择上方的智能体，输入一个主题即可开始。", "Choose an agent above and enter a theme.")}</p>
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
                      ? t("云朵漫画", "Cloud Comic")
                      : t("人生副本", "Life Story")}
                  </span>
                  <h3>{project.name}</h3>
                  <p>
                    {project.draft?.summary ||
                      project.brief ||
                      t("创作还在酝酿，进来写下第一个想法。", "Open the project and add your first idea.")}
                  </p>
                  <footer>
                    <span
                      className={
                        isActive(project.job?.status) ? 'agent-live' : ''
                      }
                    >
                      {project.job ? statusLabel(project.job.status) : t("草稿", "Draft")}
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
              {t("上一页", "Previous")}
            </button>
            <span>{t("第", "Page")} {page} {t("页", "")}</span>
            <button
              className="btn btn-default"
              disabled={page * 20 >= total || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              {t("下一页", "Next")}
            </button>
          </div>
        )}
      </section>
      {deleting && (
        <KnowledgeModal
          title={t("删除这个创作项目？", "Delete this project?")}
          onClose={() => setDeleting(null)}
          busy={loading}
        >
          <p className="agent-delete-description">
            “{deleting.name}{t("”的分镜和生成素材将被清理。", "” and its generated assets will be deleted.")}
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
              {t("保留作品", "Keep project")}
            </button>
            <button
              className="btn btn-primary"
              disabled={loading}
              onClick={() => void remove()}
            >
              {t("确认删除", "Delete")}
            </button>
          </div>
        </KnowledgeModal>
      )}
      {catalog && (
        <span className="agent-screenreader">
          {t("已连接", "Connected to")} {catalog.agents.length} {t("个创作智能体", "agents")}
        </span>
      )}
    </main>
  );
}
