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

const STATUS_LABELS = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};
const NODE_ICONS = {
  llm: FiFileText,
  imageGeneration: FiImage,
  videoGeneration: FiVideo,
};
const editPath = (workflow) =>
  `/workflows/${workflow.id}/edit${workflow.isLocal ? '?local=true' : ''}`;

export default function WorkflowList() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [workflows, setWorkflows] = useState([]);
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
    } catch (err) {
      if (version !== requestVersion.current) return;
      setWorkflows(drafts);
      setServerCount(0);
      setError(`${err.message || '服务端读取失败'}，当前仅显示本地草稿。`);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isLoggedIn, page, keyword, filterStatus]);

  useEffect(() => {
    const pendingRequests = requestVersion;
    const timer = setTimeout(fetchWorkflows, 250);
    return () => {
      clearTimeout(timer);
      pendingRequests.current++;
    };
  }, [fetchWorkflows]);

  const handleDelete = async (workflow) => {
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
    } catch (err) {
      setError(err.message || '删除失败，请重试');
    } finally {
      setPending('');
    }
  };

  const handlePublish = async (workflow) => {
    setPending(`publish-${workflow.id}`);
    setError('');
    const nextStatus = workflow.status === 'published' ? 'draft' : 'published';
    try {
      await workflowDefAPI.toggleWorkflow(workflow.id, nextStatus);
      await fetchWorkflows();
    } catch (err) {
      setError(err.message || '状态更新失败');
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
          <h1>我的工作流</h1>
          <p>连接模型与灵感，管理每一条创作流程。</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/workflows/new/edit')}
        >
          <FiPlus /> 新建工作流
        </button>
      </header>
      {!isLoggedIn && (
        <div className="notice">
          <FiGitBranch />
          <span>
            当前为访客空间，工作流保存在此浏览器。
            <Link to="/login">登录后可同步并运行模型。</Link>
          </span>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button className="text-action" onClick={fetchWorkflows}>
            重试
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
              {status === 'all' ? '全部工作流' : STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <label className="workflow-search">
          <FiSearch />
          <input
            aria-label="搜索工作流"
            value={keyword}
            placeholder="搜索工作流名称"
            disabled={Boolean(pending)}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <button
          className="btn-icon"
          aria-label="刷新工作流"
          onClick={fetchWorkflows}
          disabled={loading || Boolean(pending)}
        >
          <FiRefreshCw className={loading ? 'spinning' : ''} />
        </button>
      </section>
      {loading ? (
        <div className="loading-state">
          <FiRefreshCw className="spinning" /> 正在读取工作流
        </div>
      ) : visibleWorkflows.length === 0 ? (
        <section className="surface empty-state">
          <span className="empty-state-icon">
            <FiGitBranch />
          </span>
          <h3>
            {keyword || filterStatus !== 'all'
              ? '没有找到匹配的工作流'
              : '你的下一个灵感，从这里开始'}
          </h3>
          <p>
            {keyword || filterStatus !== 'all'
              ? '试试其他关键词，或切换到全部工作流。'
              : '创建一个空白画布，或从文本、图片、视频起点快速开始。'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/workflows/new/edit')}
          >
            <FiPlus /> 创建工作流
          </button>
          <div className="workflow-empty-starters">
            <Link to="/workflows/new/edit?starter=text">
              文本创作 <FiArrowRight />
            </Link>
            <Link to="/workflows/new/edit?starter=image">
              图片生成 <FiArrowRight />
            </Link>
            <Link to="/workflows/new/edit?starter=video">
              视频短片 <FiArrowRight />
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
                      <span className="badge">本地草稿</span>
                    )}
                    <span className={`badge ${workflow.status || 'draft'}`}>
                      {STATUS_LABELS[workflow.status] || '草稿'}
                    </span>
                  </div>
                </div>
                <Link className="workflow-card-title" to={editPath(workflow)}>
                  {workflow.name || '未命名工作流'}
                  <FiArrowUpRight />
                </Link>
                <p className="workflow-card-description">
                  {workflow.description || '每一条连接，都通向一个新的可能。'}
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
                      <FiZap /> 待添加模型节点
                    </span>
                  )}
                </div>
                <div className="workflow-card-metrics">
                  <span>
                    <b>{workflow.nodes?.length || 0}</b> 节点
                  </span>
                  <span>
                    <b>{workflow.runStats?.totalRuns || 0}</b> 次运行
                  </span>
                  <span
                    className={
                      workflow.latestValidation?.valid ? 'checked' : ''
                    }
                  >
                    {workflow.latestValidation?.valid
                      ? '✓ 结构已校验'
                      : '待校验'}
                  </span>
                </div>
                <div className="workflow-card-footer">
                  <span>
                    {workflow.updated_at
                      ? dayjs(workflow.updated_at).format('MM-DD HH:mm')
                      : '尚未保存'}
                  </span>
                  <div>
                    <button
                      className="btn-icon"
                      title="编辑并配置运行"
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
                          ? '处理中'
                          : workflow.status === 'published'
                            ? '撤回'
                            : '发布'}
                      </button>
                    )}
                    <button
                      className="btn-icon btn-danger"
                      title="删除工作流"
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
            <strong>创建新的工作流</strong>
            <small>给下一个想法，一张空白画布</small>
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
            上一页
          </button>
          <span>第 {page} 页</span>
          <button
            className="btn btn-default"
            disabled={serverCount < 20 || loading || Boolean(pending)}
            onClick={() => setPage(page + 1)}
          >
            下一页
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
