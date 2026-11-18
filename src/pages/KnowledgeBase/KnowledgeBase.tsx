import { normalizeError } from '../../types/api';
import type { KnowledgeBase as KnowledgeBaseRecord, KnowledgeConfig } from '../../types/knowledge';
import type { BaseFormValues } from './KnowledgeBaseShared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiArrowUpRight,
  FiBookOpen,
  FiDatabase,
  FiEdit2,
  FiFileText,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { knowledgeAPI } from '../../services/knowledgeApi';
import {
  BaseForm,
  formatDate,
  KnowledgeError,
  KnowledgeLoading,
  KnowledgeLogin,
  KnowledgeModal,
  KnowledgePagination,
  KnowledgeStatus,
} from './KnowledgeBaseShared';
import './KnowledgeBase.css';

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [config, setConfig] = useState<KnowledgeConfig | null>(null);
  const [items, setItems] = useState<KnowledgeBaseRecord[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState<Partial<KnowledgeBaseRecord> | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeBaseRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [configuration, response] = await Promise.all([
        knowledgeAPI.config(),
        knowledgeAPI.list({
          page,
          pageSize: 20,
          ...(query.trim() ? { q: query.trim() } : {}),
        }),
      ]);
      if (version !== requestVersion.current) return;
      setConfig(configuration.data);
      setItems(response.data.items);
      setTotal(response.data.total);
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      if (version === requestVersion.current) {
        setItems([]);
        setTotal(null);
        setError(err.message || '读取知识库失败，请重试');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isLoggedIn, page, query]);
  useEffect(() => {
    const versionRef = requestVersion;
    const timer = setTimeout(load, 250);
    return () => {
      clearTimeout(timer);
      versionRef.current += 1;
    };
  }, [load]);
  const save = async (values: BaseFormValues) => {
    if (!editing) return;
    setBusy(true);
    setFormError('');
    try {
      if (editing.id) {
        await knowledgeAPI.update(editing.id, values);
        setEditing(null);
        await load();
      } else {
        const response = await knowledgeAPI.create(values);
        setEditing(null);
        navigate(`/knowledge/${response.data.id}`);
      }
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setFormError(err.message || '保存失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setFormError('');
    try {
      await knowledgeAPI.delete(deleting.id);
      setDeleting(null);
      if (items.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setFormError(err.message || '删除失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page-wrap kb-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">KNOWLEDGE WORKSPACE</span>
          <h1>知识库</h1>
          <p>把文档整理成可检索的知识，为工作流提供可靠的上下文。</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={!isLoggedIn || !config?.configured}
          onClick={() => {
            setFormError('');
            setEditing({});
          }}
        >
          <FiPlus /> 新建知识库
        </button>
      </header>
      {!isLoggedIn ? (
        <KnowledgeLogin />
      ) : (
        <>
          {config?.configured === false && (
            <div className="notice kb-notice" role="status">
              <FiDatabase />
              <span>
                知识库服务尚未配置。请联系管理员开通后导入文档与检索。
              </span>
            </div>
          )}
          <KnowledgeError message={error} retry={load} />
          <section className="kb-intro">
            <span className="kb-intro-icon">
              <FiBookOpen />
            </span>
            <div>
              <h2>文档有出处，回答有依据。</h2>
              <p>导入文档 → 检查分段 → 检索测试 → 连接工作流</p>
            </div>
            <div className="kb-total">
              <strong>{loading || total === null ? '—' : total}</strong>
              <span>个知识库</span>
            </div>
          </section>
          <div className="kb-toolbar">
            <span className="kb-section-label">我的知识库</span>
            <label className="kb-search">
              <FiSearch />
              <input
                aria-label="搜索知识库"
                placeholder="搜索知识库名称"
                value={query}
                disabled={busy}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <button
              className="btn-icon"
              aria-label="刷新知识库"
              disabled={loading || busy}
              onClick={load}
            >
              <FiRefreshCw className={loading ? 'spinning' : ''} />
            </button>
          </div>
          {loading ? (
            <KnowledgeLoading />
          ) : items.length ? (
            <div className="kb-grid">
              {items.map((item) => (
                <article className="surface kb-card" key={item.id}>
                  <div className="kb-card-top">
                    <span className="kb-card-icon">
                      <FiDatabase />
                    </span>
                    <KnowledgeStatus
                      status={
                        item.status ||
                        (item.documentCount === 0 ? 'empty' : 'enabled')
                      }
                      enabled={item.enabled}
                    />
                  </div>
                  <Link className="kb-card-title" to={`/knowledge/${item.id}`}>
                    {item.name}
                    <FiArrowUpRight />
                  </Link>
                  <p className="kb-card-description">
                    {item.description || '暂无描述，添加文档后即可开始检索。'}
                  </p>
                  <span className="kb-mode">
                    {item.indexMode === 'dense'
                      ? '语义向量检索'
                      : '关键词检索 · BM25'}
                  </span>
                  <div className="kb-card-counts">
                    <span>
                      <FiFileText />
                      <b>{item.documentCount ?? '—'}</b> 份文档
                    </span>
                    <span>
                      <FiLayers />
                      <b>{item.chunkCount ?? '—'}</b> 个分段
                    </span>
                  </div>
                  <footer className="kb-card-footer">
                    <small>更新于 {formatDate(item.updatedAt)}</small>
                    <div>
                      <button
                        className="btn-icon"
                        aria-label={`编辑 ${item.name}`}
                        disabled={busy}
                        onClick={() => {
                          setFormError('');
                          setEditing(item);
                        }}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        aria-label={`删除 ${item.name}`}
                        disabled={busy}
                        onClick={() => {
                          setFormError('');
                          setDeleting(item);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            !error && (
              <section className="surface empty-state kb-empty">
                <span className="empty-state-icon">
                  <FiDatabase />
                </span>
                <h2>{query ? '没有找到匹配的知识库' : '从第一份文档开始'}</h2>
                <p>
                  {query
                    ? '试试其他名称，或清空搜索条件。'
                    : '创建知识库，导入产品手册、业务说明或常用资料。'}
                </p>
                {query ? (
                  <button className="text-action" onClick={() => setQuery('')}>
                    查看全部知识库
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={!config?.configured}
                    onClick={() => {
                      setFormError('');
                      setEditing({});
                    }}
                  >
                    <FiPlus /> 新建知识库
                  </button>
                )}
              </section>
            )
          )}
          <KnowledgePagination
            page={page}
            total={total}
            loading={loading || busy}
            onChange={setPage}
          />
        </>
      )}
      {editing && (
        <KnowledgeModal
          title={editing.id ? '编辑知识库' : '新建知识库'}
          description="为文档设置清晰的用途与检索方式。"
          onClose={() => setEditing(null)}
          busy={busy}
        >
          <KnowledgeError message={formError} />
          <BaseForm
            value={editing}
            config={config}
            busy={busy}
            onSave={save}
            submitLabel={editing.id ? '保存修改' : '创建知识库'}
          />
        </KnowledgeModal>
      )}
      {deleting && (
        <KnowledgeModal
          title="删除知识库"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p className="kb-confirm-text">
            确定删除“{deleting.name}
            ”？库中的文档与分段索引会一并移除，此操作无法撤销。
          </p>
          <KnowledgeError message={formError} />
          <div className="kb-modal-actions">
            <button
              className="btn btn-default"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              取消
            </button>
            <button
              className="btn kb-danger-button"
              disabled={busy}
              onClick={remove}
            >
              {busy ? '正在删除' : '确认删除'}
            </button>
          </div>
        </KnowledgeModal>
      )}
    </main>
  );
}
