import { useLabels } from '../../store/languageStore';
import { normalizeError } from '../../types/api';
import type { IconType } from 'react-icons';
import type { Workflow } from '../../types/workflow';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiPlus,
  FiSearch,
  FiGitBranch,
  FiArrowUpRight,
  FiPlay,
  FiTrash2,
  FiRefreshCw,
  FiZap,
  FiArrowRight,
  FiFileText,
  FiImage,
  FiVideo,
} from 'react-icons/fi';
import dayjs from 'dayjs';
import { workflowDefAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';
import localStorageService from '../../services/localStorage';
import './WorkflowList.css';

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};
const NODE_ICONS: Record<string, IconType> = {
  llm: FiFileText,
  imageGeneration: FiImage,
  videoGeneration: FiVideo,
};
const editPath = (workflow: Workflow) =>
  `/workflows/${workflow.id}/edit${workflow.isLocal ? '?local=true' : ''}`;

export default function WorkflowList() {
  const t = useLabels();
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const [page, setPage] = useState(1);
  const [serverCount, setServerCount] = useState(0);
  const requestVersion = useRef(0);

  const fetchWorkflows = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    const drafts = localStorageService
      .getWorkflows()
      .map((item) => ({ ...item, isLocal: true }));
    if (!isLoggedIn) {
      setWorkflows(drafts);
      setServerCount(0);
      setLoading(false);
      return;
    }
    try {
      const response = await workflowDefAPI.getWorkflows({
        page,
        ...(keyword.trim()
          ? { keyword: keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
          : {}),
        ...(filterStatus === 'all' ? {} : { status: filterStatus }),
      });
      if (version !== requestVersion.current) return;
      setServerCount(response.data.length);
      setWorkflows([...response.data, ...drafts]);
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      if (version !== requestVersion.current) return;
      setWorkflows(drafts);
      setServerCount(0);
      setError(`${err.message || t("服务端读取失败", "Could not load workflows")}，当前仅显示本地草稿。`);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isLoggedIn, page, keyword, filterStatus, t]);

  useEffect(() => {
    const pendingRequests = requestVersion;
    const timer = setTimeout(fetchWorkflows, 250);
    return () => {
      clearTimeout(timer);
      pendingRequests.current++;
    };
  }, [fetchWorkflows]);

  const handleDelete = async (workflow: Workflow) => {
    if (!workflow.id) {
      setError(t("工作流缺少 ID，请刷新后重试", "Workflow ID missing. Refresh and try again."));
      return;
    }
    if (!window.confirm(`删除工作流“${workflow.name}”？此操作无法撤销。`))
      return;
    setPending(`delete-${workflow.id}`);
    setError('');
    try {
      if (workflow.isLocal) localStorageService.deleteWorkflow(workflow.id);
      else await workflowDefAPI.deleteWorkflow(workflow.id);
      setWorkflows((items) =>
        items.filter(
          (item) =>
            !(item.id === workflow.id && item.isLocal === workflow.isLocal)
        )
      );
      if (!workflow.isLocal && serverCount <= 1 && page > 1) setPage(page - 1);
      else await fetchWorkflows();
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setError(err.message || t("删除失败，请重试", "Could not delete. Try again."));
    } finally {
      setPending('');
    }
  };

  const handlePublish = async (workflow: Workflow) => {
    if (!workflow.id) {
      setError(t("工作流缺少 ID，请刷新后重试", "Workflow ID missing. Refresh and try again."));
      return;
    }
    setPending(`publish-${workflow.id}`);
    setError('');
    const nextStatus = workflow.status === 'published' ? 'draft' : 'published';
    try {
      await workflowDefAPI.toggleWorkflow(workflow.id, nextStatus);
      await fetchWorkflows();
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setError(err.message || t("状态更新失败", "Could not update status"));
    } finally {
      setPending('');
    }
  };

  const visibleWorkflows = workflows.filter(
    (workflow) =>
      (filterStatus === 'all' ||
        (workflow.status || 'draft') === filterStatus) &&
      `${workflow.name || ''}`
        .toLowerCase()
        .includes(keyword.trim().toLowerCase())
  );

  return (
    <main className="page-wrap workflow-list-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">BUILD. CONNECT. CREATE.</span>
          <h1>{t("我的工作流", "My workflows")}</h1>
          <p>{t("连接模型与灵感，管理每一条创作流程。", "Build, connect and manage your workflows.")}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/workflows/new/edit')}
        >
          <FiPlus /> {t("新建工作流", "New workflow")}
        </button>
      </header>
      {!isLoggedIn && (
        <div className="notice">
          <FiGitBranch />
          <span>
            {t("当前为访客空间，工作流保存在此浏览器。", "Guest workflows are saved in this browser.")}
            <Link to="/login">{t("登录后可同步并运行模型。", "Sign in to sync workflows and run models.")}</Link>
          </span>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button className="text-action" onClick={fetchWorkflows}>
            {t("重试", "Retry")}
          </button>
        </div>
      )}
      <section className="workflow-filters">
        <div className="workflow-tabs">
          {['all', 'draft', 'published', 'archived'].map((status) => (
            <button
              key={status}
              className={filterStatus === status ? 'active' : ''}
              disabled={Boolean(pending)}
              onClick={() => {
                setFilterStatus(status);
                setPage(1);
              }}
            >
              {status === 'all' ? t("全部工作流", "All workflows") : t(STATUS_LABELS[status], status)}
            </button>
          ))}
        </div>
        <label className="workflow-search">
          <FiSearch />
          <input
            aria-label={t("搜索工作流", "Search workflows")}
            value={keyword}
            placeholder={t("搜索工作流名称", "Search workflow names")}
            disabled={Boolean(pending)}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <button
          className="btn-icon"
          aria-label={t("刷新工作流", "Refresh workflows")}
          onClick={fetchWorkflows}
          disabled={loading || Boolean(pending)}
        >
          <FiRefreshCw className={loading ? 'spinning' : ''} />
        </button>
      </section>
      {loading ? (
        <div className="loading-state">
          <FiRefreshCw className="spinning" /> {t("正在读取工作流", "Loading workflows")}
        </div>
      ) : visibleWorkflows.length === 0 ? (
        <section className="surface empty-state">
          <span className="empty-state-icon">
            <FiGitBranch />
          </span>
          <h3>
            {keyword || filterStatus !== 'all'
              ? t("没有找到匹配的工作流", "No matching workflows")
              : t("你的下一个灵感，从这里开始", "Start your first workflow")}
          </h3>
          <p>
            {keyword || filterStatus !== 'all'
              ? t("试试其他关键词，或切换到全部工作流。", "Try another keyword or switch to all workflows.")
              : t("创建一个空白画布，或从文本、图片、视频起点快速开始。", "Start from a blank canvas or use a text, image or video template.")}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/workflows/new/edit')}
          >
            <FiPlus /> {t("创建工作流", "Create workflow")}
          </button>
          <div className="workflow-empty-starters">
            <Link to="/workflows/new/edit?starter=text">
              {t("文本创作", "Text creation")} <FiArrowRight />
            </Link>
            <Link to="/workflows/new/edit?starter=image">
              {t("图片生成", "Image generation")} <FiArrowRight />
            </Link>
            <Link to="/workflows/new/edit?starter=video">
              {t("视频短片", "Short video")} <FiArrowRight />
            </Link>
          </div>
        </section>
      ) : (
        <section className="workflow-grid">
          {visibleWorkflows.map((workflow) => {
            const modelNodes = (workflow.nodes || []).filter(
              (node) => NODE_ICONS[node.data?.type || node.type]
            );
            return (
              <article
                className="surface workflow-card"
                key={`${workflow.isLocal ? 'local' : 'server'}-${workflow.id}`}
              >
                <div className="workflow-card-top">
                  <span className="workflow-card-icon">
                    <FiGitBranch />
                  </span>
                  <div className="workflow-card-badges">
                    {workflow.isLocal && (
                      <span className="badge">{t("本地草稿", "Local draft")}</span>
                    )}
                    <span className={`badge ${workflow.status || 'draft'}`}>
                      {t(STATUS_LABELS[workflow.status || 'draft'] || '草稿', workflow.status || 'Draft')}
                    </span>
                  </div>
                </div>
                <Link className="workflow-card-title" to={editPath(workflow)}>
                  {workflow.name || t("未命名工作流", "Untitled workflow")}
                  <FiArrowUpRight />
                </Link>
                <p className="workflow-card-description">
                  {workflow.description || t("每一条连接，都通向一个新的可能。", "Connect nodes to build your workflow.")}
                </p>
                <div className="workflow-card-nodes">
                  {modelNodes.slice(0, 4).map((node) => {
                    const Icon = NODE_ICONS[node.data?.type || node.type];
                    return (
                      <span key={node.id}>
                        <Icon />
                        {node.data?.label || node.name}
                      </span>
                    );
                  })}
                  {modelNodes.length === 0 && (
                    <span>
                      <FiZap /> {t("待添加模型节点", "No model nodes yet")}
                    </span>
                  )}
                </div>
                <div className="workflow-card-metrics">
                  <span>
                    <b>{workflow.nodes?.length || 0}</b> {t("节点", "nodes")}
                  </span>
                  <span>
                    <b>{workflow.runStats?.totalRuns || 0}</b> {t("次运行", "runs")}
                  </span>
                  <span
                    className={
                      workflow.latestValidation?.valid ? 'checked' : ''
                    }
                  >
                    {workflow.latestValidation?.valid
                      ? t("✓ 结构已校验", "✓ Validated")
                      : t("待校验", "Pending validation")}
                  </span>
                </div>
                <div className="workflow-card-footer">
                  <span>
                    {workflow.updated_at
                      ? dayjs(workflow.updated_at).format('MM-DD HH:mm')
                      : t("尚未保存", "Unsaved")}
                  </span>
                  <div>
                    <button
                      className="btn-icon"
                      title={t("编辑并配置运行", "Edit and configure")}
                      aria-label={`编辑 ${workflow.name}`}
                      onClick={() => navigate(editPath(workflow))}
                    >
                      <FiPlay />
                    </button>
                    {!workflow.isLocal && (
                      <button
                        className="workflow-publish"
                        disabled={Boolean(pending)}
                        onClick={() => handlePublish(workflow)}
                      >
                        {pending === `publish-${workflow.id}`
                          ? t("处理中", "Working")
                          : workflow.status === 'published'
                            ? t("撤回", "Unpublish")
                            : t("发布", "Publish")}
                      </button>
                    )}
                    <button
                      className="btn-icon btn-danger"
                      title={t("删除工作流", "Delete workflow")}
                      aria-label={`删除 ${workflow.name}`}
                      disabled={Boolean(pending)}
                      onClick={() => handleDelete(workflow)}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <button
            className="workflow-add-card"
            onClick={() => navigate('/workflows/new/edit')}
          >
            <span>
              <FiPlus />
            </span>
            <strong>{t("创建新的工作流", "Create a workflow")}</strong>
            <small>{t("给下一个想法，一张空白画布", "Start with a blank canvas")}</small>
          </button>
        </section>
      )}
      {isLoggedIn && (
        <div className="pagination">
          <button
            className="btn btn-default"
            disabled={page === 1 || loading || Boolean(pending)}
            onClick={() => setPage(page - 1)}
          >
            {t("上一页", "Previous")}
          </button>
          <span>{t("第", "Page")} {page} {t("页", "")}</span>
          <button
            className="btn btn-default"
            disabled={serverCount < 20 || loading || Boolean(pending)}
            onClick={() => setPage(page + 1)}
          >
            {t("下一页", "Next")}
          </button>
        </div>
      )}
      <footer className="studio-bottom">
        <span>{visibleWorkflows.length} WORKFLOWS IN THIS VIEW</span>
        <span>FLASH MODELS · CONNECTED CREATIVITY</span>
      </footer>
    </main>
  );
}
