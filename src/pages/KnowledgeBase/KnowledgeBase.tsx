import { useLabels } from '../../store/languageStore';
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
  const t = useLabels();
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
        setError(err.message || t("读取知识库失败，请重试", "Could not load knowledge bases. Try again."));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isLoggedIn, page, query, t]);
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
      setFormError(err.message || t("保存失败，请重试", "Could not save. Try again."));
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
      setFormError(err.message || t("删除失败，请重试", "Could not delete. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page-wrap kb-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">KNOWLEDGE WORKSPACE</span>
          <h1>{t("知识库", "Knowledge bases")}</h1>
          <p>{t("把文档整理成可检索的知识，为工作流提供可靠的上下文。", "Build searchable collections of documents for your workflows.")}</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={!isLoggedIn || !config?.configured}
          onClick={() => {
            setFormError('');
            setEditing({});
          }}
        >
          <FiPlus /> {t("新建知识库", "New knowledge base")}
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
                {t("知识库服务尚未配置。请联系管理员开通后导入文档与检索。", "Knowledge services are not configured. Contact your administrator to enable document import and search.")}
              </span>
            </div>
          )}
          <KnowledgeError message={error} retry={load} />
          <section className="kb-intro">
            <span className="kb-intro-icon">
              <FiBookOpen />
            </span>
            <div>
              <h2>{t("文档有出处，回答有依据。", "Find answers in your documents.")}</h2>
              <p>{t("导入文档 → 检查分段 → 检索测试 → 连接工作流", "Import documents → Check chunks → Test retrieval → Connect a workflow")}</p>
            </div>
            <div className="kb-total">
              <strong>{loading || total === null ? '—' : total}</strong>
              <span>{t("个知识库", "knowledge bases")}</span>
            </div>
          </section>
          <div className="kb-toolbar">
            <span className="kb-section-label">{t("我的知识库", "My knowledge bases")}</span>
            <label className="kb-search">
              <FiSearch />
              <input
                aria-label={t("搜索知识库", "Search knowledge bases")}
                placeholder={t("搜索知识库名称", "Search knowledge base names")}
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
              aria-label={t("刷新知识库", "Refresh knowledge bases")}
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
                    {item.description || t("暂无描述，添加文档后即可开始检索。", "Add documents to start searching.")}
                  </p>
                  <span className="kb-mode">
                    {item.indexMode === 'dense'
                      ? t("语义向量检索", "Semantic vector search")
                      : t("关键词检索 · BM25", "Keyword search · BM25")}
                  </span>
                  <div className="kb-card-counts">
                    <span>
                      <FiFileText />
                      <b>{item.documentCount ?? '—'}</b> {t("份文档", "documents")}
                    </span>
                    <span>
                      <FiLayers />
                      <b>{item.chunkCount ?? '—'}</b> {t("个分段", "chunks")}
                    </span>
                  </div>
                  <footer className="kb-card-footer">
                    <small>{t("更新于", "Updated")} {formatDate(item.updatedAt)}</small>
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
                <h2>{query ? t("没有找到匹配的知识库", "No matching knowledge bases") : t("从第一份文档开始", "Start with a document")}</h2>
                <p>
                  {query
                    ? t("试试其他名称，或清空搜索条件。", "Try another name or clear your search.")
                    : t("创建知识库，导入产品手册、业务说明或常用资料。", "Create a knowledge base and import manuals, policies or reference material.")}
                </p>
                {query ? (
                  <button className="text-action" onClick={() => setQuery('')}>
                    {t("查看全部知识库", "View all knowledge bases")}
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
                    <FiPlus /> {t("新建知识库", "New knowledge base")}
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
          title={editing.id ? t("编辑知识库", "Edit knowledge base") : t("新建知识库", "New knowledge base")}
          description={t("为文档设置清晰的用途与检索方式。", "Set a purpose and a search method for these documents.")}
          onClose={() => setEditing(null)}
          busy={busy}
        >
          <KnowledgeError message={formError} />
          <BaseForm
            value={editing}
            config={config}
            busy={busy}
            onSave={save}
            submitLabel={editing.id ? t("保存修改", "Save changes") : t("创建知识库", "Create knowledge base")}
          />
        </KnowledgeModal>
      )}
      {deleting && (
        <KnowledgeModal
          title={t("删除知识库", "Delete knowledge base")}
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p className="kb-confirm-text">
            {t("确定删除“", "Delete “")}{deleting.name}
            {t("”？库中的文档与分段索引会一并移除，此操作无法撤销。", "” and all its documents and search indexes? This cannot be undone.")}
          </p>
          <KnowledgeError message={formError} />
          <div className="kb-modal-actions">
            <button
              className="btn btn-default"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              {t("取消", "Cancel")}
            </button>
            <button
              className="btn kb-danger-button"
              disabled={busy}
              onClick={remove}
            >
              {busy ? t("正在删除", "Deleting") : t("确认删除", "Delete")}
            </button>
          </div>
        </KnowledgeModal>
      )}
    </main>
  );
}
