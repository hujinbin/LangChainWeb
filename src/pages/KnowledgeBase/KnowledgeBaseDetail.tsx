import { useLabels } from '../../store/languageStore';
import type { IconType } from 'react-icons';
import type { DocumentDetail, KnowledgeBase, KnowledgeConfig, KnowledgeDocument, RetrievalResult } from '../../types/knowledge';
import type { BaseFormValues } from './KnowledgeBaseShared';
import { normalizeError } from '../../types/api';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiBookOpen,
  FiCheckCircle,
  FiDatabase,
  FiFileText,
  FiLayers,
  FiPause,
  FiPlay,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSettings,
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
import KnowledgeBaseImport from './KnowledgeBaseImport';
import './KnowledgeBase.css';

interface DocumentSelection {
  id: string;
  name?: string;
  chunkIndex?: number;
  page?: number;
}


function DocumentChunks({
  baseId,
  selection,
  onClose,
}: {
  baseId: string;
  selection: DocumentSelection;
  onClose: () => void;
}) {
  const t = useLabels();
  const [page, setPage] = useState(selection.page || 1);
  const [data, setData] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    knowledgeAPI
      .document(
        baseId,
        selection.id,
        { page, pageSize: 20 },
        { signal: controller.signal },
      )
      .then((response) => {
        if (!controller.signal.aborted) setData(response.data);
      })
      .catch((caughtError: unknown) => {
        const err = normalizeError(caughtError);
        if (!controller.signal.aborted)
          setError(err.message || t("读取文档分段失败", "Could not load document chunks"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [baseId, selection.id, page, revision, t]);
  return (
    <KnowledgeModal
      title={selection.name || t("文档分段", "Document chunks")}
      description={t("查看实际保存的文档分段与引用内容。", "Inspect saved chunks and their source text.")}
      wide
      onClose={onClose}
    >
      <KnowledgeError message={error} retry={() => setRevision(revision + 1)} />
      {loading ? (
        <KnowledgeLoading text={t("正在读取文档分段", "Loading chunks")} />
      ) : (
        data && (
          <>
            <div className="kb-chunks-summary">
              <KnowledgeStatus status={data.status} enabled={data.enabled} />
              <span>{data.totalChunks ?? data.chunkCount} {t("个分段", "chunks")}</span>
            </div>
            {data.chunks?.length ? (
              <div className="kb-document-chunks">
                {data.chunks.map((chunk) => (
                  <article
                    className={`kb-chunk ${selection.chunkIndex === chunk.index ? 'kb-chunk-highlight' : ''}`}
                    key={chunk.id || chunk.index}
                  >
                    <div>
                      <b>{t("分段", "Chunk")} {chunk.index + 1}</b>
                      <small>
                        {chunk.characters ?? chunk.content.length} {t("字符", "characters")}
                      </small>
                    </div>
                    <p>{chunk.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="kb-muted">{t("文档暂无可查看的分段，请检查索引状态。", "No chunks available. Check indexing status.")}</p>
            )}
            <KnowledgePagination
              page={page}
              total={data.totalChunks || 0}
              loading={loading}
              onChange={setPage}
            />
          </>
        )
      )}
    </KnowledgeModal>
  );
}

function RetrievalTest({
  base,
  configured,
  onCitation,
}: {
  base: KnowledgeBase;
  configured?: boolean;
  onCitation: (selection: DocumentSelection) => void;
}) {
  const t = useLabels();
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState<string | number>(base.topK || 5);
  const [scoreThreshold, setScoreThreshold] = useState<string | number>(
    base.scoreThreshold || 0,
  );
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const retrieve = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await knowledgeAPI.retrieve(
        base.id,
        {
          query: query.trim(),
          topK: Number(topK),
          scoreThreshold: Number(scoreThreshold),
        },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setResult(response.data);
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      if (!controller.signal.aborted)
        setError(err.message || t("检索失败，请重试", "Search failed. Try again."));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <section className="kb-retrieval-layout">
      <form className="surface kb-retrieval-form kb-form" onSubmit={retrieve}>
        <span className="kb-section-label">{t("检索测试", "Test retrieval")}</span>
        <h2>{t("这份知识，能回答什么？", "Ask a question about your documents")}</h2>
        <p className="kb-muted">{t("使用真实文档检索，检查命中内容与引用。", "Search the documents and inspect the matching passages.")}</p>
        <label htmlFor="kb-retrieve-query">
          {t("检索问题", "Question")}
          <textarea
            id="kb-retrieve-query"
            rows={6}
            required
            maxLength={6000}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("例如：产品支持哪些文件格式？", "For example, which file formats are supported?")}
            disabled={loading}
          />
        </label>
        <div className="kb-form-grid">
          <label htmlFor="kb-retrieve-topk">
            {t("命中数量", "Result count")}
            <input
              id="kb-retrieve-topk"
              type="number"
              min={1}
              max={20}
              step={1}
              required
              value={topK}
              onChange={(event) => setTopK(event.target.value)}
              disabled={loading}
            />
          </label>
          <label htmlFor="kb-retrieve-score">
            {t("最低检索得分", "Minimum score")}
            <input
              id="kb-retrieve-score"
              type="number"
              min={0}
              max={base.indexMode === 'dense' ? 1 : 10000}
              step={0.01}
              required
              value={scoreThreshold}
              onChange={(event) => setScoreThreshold(event.target.value)}
              disabled={loading}
            />
          </label>
        </div>
        <div className="kb-mode-note">
          <FiDatabase />
          <span>
            {base.indexMode === 'dense' ? t("语义向量检索", "Semantic vector search") : t("关键词检索 · BM25", "Keyword search · BM25")}
            <small>
              {base.indexMode === 'dense'
                ? t("按文本语义查找相关内容。", "Find passages with related meaning.")
                : t("检索得分用于排序，不代表语义相似率。", "Scores rank results. They do not represent a percentage match.")}
            </small>
          </span>
        </div>
        <button
          className="btn btn-primary"
          disabled={
            loading || !configured || base.enabled === false || !query.trim()
          }
        >
          {loading ? <FiRefreshCw className="spinning" /> : <FiSearch />}
          {loading ? t("正在检索", "Searching") : t("开始检索", "Search")}
        </button>
        {base.enabled === false && (
          <p className="kb-muted">{t("知识库已停用，请在设置中启用后测试。", "Enable this knowledge base in Settings to test retrieval.")}</p>
        )}
        <KnowledgeError message={error} />
      </form>
      <div className="kb-retrieval-results" aria-live="polite">
        {loading ? (
          <KnowledgeLoading text={t("正在检索相关文档", "Searching documents")} />
        ) : result ? (
          <>
            <header className="kb-results-heading">
              <h2>
                {t("检索结果", "Search results")} <span>{result.documents?.length || 0}</span>
              </h2>
              <p>{t("问题：", "Question:")}{result.query}</p>
            </header>
            {result.documents?.length ? (
              result.documents.map((hit, index) => (
                <article
                  className="surface kb-hit"
                  key={hit.id || `${hit.documentId}-${hit.chunkIndex}-${index}`}
                >
                  <header>
                    <span className="kb-hit-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <strong>
                        {hit.title || hit.sourceName || t("文档引用", "Source")}
                      </strong>
                      <small>{t("分段", "Chunk")} {Number(hit.chunkIndex || 0) + 1}</small>
                    </div>
                    <span className="kb-score">
                      {t("得分", "Score")}{' '}
                      {Number.isFinite(hit.score) ? hit.score.toFixed(4) : '—'}
                    </span>
                  </header>
                  <p>{hit.content}</p>
                  <footer>
                    <FiFileText />
                    <span>{hit.sourceName || hit.title || t("文档", "Document")}</span>
                    {hit.documentId && (
                      <button
                        className="text-action"
                        onClick={() =>
                          onCitation({
                            id: hit.documentId || '',
                            name: hit.title || hit.sourceName,
                            chunkIndex: hit.chunkIndex,
                            page:
                              Math.floor(Number(hit.chunkIndex || 0) / 20) + 1,
                          })
                        }
                      >
                        {t("查看引用", "View source")} <FiArrowUpRight />
                      </button>
                    )}
                  </footer>
                </article>
              ))
            ) : (
              <section className="surface empty-state kb-empty">
                <span className="empty-state-icon">
                  <FiSearch />
                </span>
                <h3>{t("未找到命中内容", "No matches")}</h3>
                <p>
                  {t("尝试更具体的关键词、降低最低得分，或确认文档已启用并完成索引。", "Try a more specific term or lower score. Check that the documents are enabled and indexed.")}
                </p>
              </section>
            )}
          </>
        ) : (
          <section className="kb-test-placeholder">
            <span>
              <FiSearch />
            </span>
            <h3>{t("先问一个问题", "Enter a question")}</h3>
            <p>{t("命中的文档分段与原文引用，会显示在这里。", "Matching passages and source references will appear here.")}</p>
          </section>
        )}
      </div>
    </section>
  );
}

export default function KnowledgeBaseDetail() {
  const t = useLabels();
  const { id = '' } = useParams();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [base, setBase] = useState<KnowledgeBase | null>(null);
  const [config, setConfig] = useState<KnowledgeConfig | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('documents');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState('');
  const [importing, setImporting] = useState(false);
  const [selection, setSelection] = useState<DocumentSelection | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeDocument | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const requestVersion = useRef(0);
  useEffect(() => {
    setBase(null);
    setDocuments([]);
    setSelection(null);
    setImporting(false);
    setPage(1);
    setQuery('');
    setTab('documents');
    setSuccess('');
  }, [id]);
  const load = useCallback(
    async ({ quiet = false } = {}) => {
      const version = ++requestVersion.current;
      if (!isLoggedIn) {
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      setError('');
      try {
        const [configuration, response, docs] = await Promise.all([
          knowledgeAPI.config(),
          knowledgeAPI.detail(id),
          knowledgeAPI.documents(id, {
            page,
            pageSize: 20,
            ...(query.trim() ? { q: query.trim() } : {}),
          }),
        ]);
        if (version !== requestVersion.current) return;
        setConfig(configuration.data);
        setBase(response.data);
        setDocuments(docs.data.items);
        setTotal(docs.data.total);
      } catch (caughtError) {
      const err = normalizeError(caughtError);
        if (version === requestVersion.current)
          setError(err.message || t("读取知识库详情失败", "Could not load knowledge base"));
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    },
    [id, isLoggedIn, page, query, t],
  );
  useEffect(() => {
    const ref = requestVersion;
    const timer = setTimeout(load, 150);
    return () => {
      clearTimeout(timer);
      ref.current += 1;
    };
  }, [load]);
  useEffect(() => {
    if (!documents.some((doc) => ['pending', 'indexing'].includes(doc.status)))
      return undefined;
    const timer = setInterval(() => load({ quiet: true }), 3000);
    return () => clearInterval(timer);
  }, [documents, load]);
  const updateDocument = async (document: KnowledgeDocument, action: 'toggle' | 'rebuild') => {
    setPending(document.id);
    setError('');
    setSuccess('');
    try {
      if (action === 'rebuild') {
        const response = await knowledgeAPI.rebuildDocument(id, document.id);
        if (response.data?.status === 'failed')
          throw new Error(t("文档索引失败，请稍后重试", "Indexing failed. Try again later."));
      } else
        await knowledgeAPI.updateDocument(id, document.id, {
          enabled: !document.enabled,
        });
      await load();
      setSuccess(
        action === 'rebuild'
          ? t("文档索引已更新。", "Document index updated.")
          : document.enabled
            ? t("文档已停用。", "Document disabled.")
            : t("文档已启用。", "Document enabled."),
      );
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      await load();
      setError(err.message || t("更新文档失败，请重试", "Could not update document."));
    } finally {
      setPending('');
    }
  };
  const deleteDocument = async () => {
    if (!deleting) return;
    setPending(deleting.id);
    setDialogError('');
    setSuccess('');
    try {
      await knowledgeAPI.deleteDocument(id, deleting.id);
      setDeleting(null);
      if (documents.length === 1 && page > 1) setPage(page - 1);
      else await load();
      setSuccess(t("文档已删除。", "Document deleted."));
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setDialogError(err.message || t("删除文档失败", "Could not delete document"));
    } finally {
      setPending('');
    }
  };
  const saveBase = async (values: BaseFormValues) => {
    setPending('settings');
    setError('');
    setSuccess('');
    try {
      await knowledgeAPI.update(id, values);
      await load();
      setSuccess(t("知识库设置已保存。", "Knowledge base settings saved."));
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setError(err.message || t("保存设置失败，请重试", "Could not save settings."));
    } finally {
      setPending('');
    }
  };
  const rebuildBase = async () => {
    setPending('rebuild');
    setDialogError('');
    setSuccess('');
    try {
      const response = await knowledgeAPI.rebuild(id);
      await load();
      if (response.data.failed) {
        setDialogError(
          `已完成 ${response.data.succeeded} 份文档，${response.data.failed} 份索引失败，请查看文档状态后重试。`,
        );
        return;
      }
      setRebuilding(false);
      setSuccess(t("知识库索引已更新。", "Knowledge base index updated."));
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      await load();
      setDialogError(err.message || t("重新索引失败，请重试", "Could not rebuild the index."));
    } finally {
      setPending('');
    }
  };
  return (
    <main className="page-wrap kb-page kb-detail-page">
      <Link className="record-back" to="/knowledge">
        <FiArrowLeft /> {t("返回知识库", "Back to knowledge bases")}
      </Link>
      <header className="page-heading">
        <div>
          <span className="eyebrow">KNOWLEDGE COLLECTION</span>
          <h1>{base?.name || t("知识库详情", "Knowledge base details")}</h1>
          <p>{base?.description || t("管理文档、检查索引并测试检索效果。", "Manage documents, inspect indexing and test retrieval.")}</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={
            !isLoggedIn || !base || !config?.configured || Boolean(pending)
          }
          onClick={() => setImporting(true)}
        >
          <FiPlus /> {t("导入文档", "Import documents")}
        </button>
      </header>
      {!isLoggedIn ? (
        <KnowledgeLogin />
      ) : (
        <>
          {config?.configured === false && (
            <div className="notice kb-notice" role="status">
              {t("知识库服务尚未配置。请联系管理员开通后导入文档与检索。", "Knowledge services are not configured. Contact your administrator.")}
            </div>
          )}
          <KnowledgeError message={error} retry={load} />
          {success && (
            <div className="kb-success" role="status">
              <FiCheckCircle />
              {success}
            </div>
          )}
          {loading && !base ? (
            <KnowledgeLoading />
          ) : (
            base && (
              <>
                <section className="surface kb-detail-summary">
                  <span className="kb-detail-symbol">
                    <FiDatabase />
                  </span>
                  <div className="kb-summary-status">
                    <KnowledgeStatus
                      status={
                        base.status ||
                        (base.documentCount === 0 ? 'empty' : 'enabled')
                      }
                      enabled={base.enabled}
                    />
                    <span>
                      {base.indexMode === 'dense'
                        ? t("语义向量检索", "Semantic vector search")
                        : t("关键词检索 · BM25", "Keyword search · BM25")}
                    </span>
                  </div>
                  <div className="kb-summary-metric">
                    <FiFileText />
                    <strong>{base.documentCount ?? '—'}</strong>
                    <span>{t("份文档", "documents")}</span>
                  </div>
                  <div className="kb-summary-metric">
                    <FiLayers />
                    <strong>{base.chunkCount ?? '—'}</strong>
                    <span>{t("个分段", "chunks")}</span>
                  </div>
                  <small>{t("更新于", "Updated")} {formatDate(base.updatedAt)}</small>
                </section>
                <div
                  className="kb-tabs"
                  role="tablist"
                  aria-label={t("知识库管理", "Manage knowledge base")}
                  onKeyDown={(event) => {
                    if (
                      !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const tabs = ['documents', 'retrieval', 'settings'];
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : (tabs.indexOf(tab) +
                              (event.key === 'ArrowRight' ? 1 : -1) +
                              tabs.length) %
                            tabs.length;
                    setTab(tabs[next]);
                    setSuccess('');
                    document.getElementById(`kb-tab-${tabs[next]}`)?.focus();
                  }}
                >
                  {([
                    ['documents', FiFileText, t("文档", "Document")],
                    ['retrieval', FiSearch, t("检索测试", "Test retrieval")],
                    ['settings', FiSettings, t("设置", "Settings")],
                  ] as [string, IconType, string][]).map(([value, Icon, label]) => (
                    <button
                      key={value}
                      role="tab"
                      id={`kb-tab-${value}`}
                      aria-controls={`kb-panel-${value}`}
                      aria-selected={tab === value}
                      tabIndex={tab === value ? 0 : -1}
                      className={tab === value ? 'active' : ''}
                      onClick={() => {
                        setTab(value);
                        setSuccess('');
                      }}
                    >
                      <Icon />
                      {label}
                    </button>
                  ))}
                </div>
                <section
                  role="tabpanel"
                  id={`kb-panel-${tab}`}
                  aria-labelledby={`kb-tab-${tab}`}
                >
                  {tab === 'documents' && (
                    <>
                      <div className="kb-toolbar">
                        <span className="kb-section-label">
                          {t("文档管理", "Documents")} <small>{total}</small>
                        </span>
                        <label className="kb-search">
                          <FiSearch />
                          <input
                            aria-label={t("搜索文档", "Search documents")}
                            value={query}
                            placeholder={t("搜索文档名称", "Search document names")}
                            disabled={Boolean(pending)}
                            onChange={(event) => {
                              setQuery(event.target.value);
                              setPage(1);
                            }}
                          />
                        </label>
                        <button
                          className="btn-icon"
                          aria-label={t("刷新文档", "Refresh documents")}
                          disabled={loading || Boolean(pending)}
                          onClick={() => load()}
                        >
                          <FiRefreshCw className={loading ? 'spinning' : ''} />
                        </button>
                      </div>
                      {loading ? (
                        <KnowledgeLoading text={t("正在读取文档", "Loading documents")} />
                      ) : documents.length ? (
                        <section
                          className="surface kb-document-list"
                          aria-label={t("知识库文档", "Knowledge base documents")}
                        >
                          <div className="kb-doc-table-heading">
                            <span>{t("文档名称", "Document name")}</span>
                            <span>{t("索引状态", "Index status")}</span>
                            <span>{t("分段", "Chunk")}</span>
                            <span>{t("更新时间", "Updated")}</span>
                            <span>{t("操作", "Actions")}</span>
                          </div>
                          {documents.map((doc) => (
                            <article className="kb-document-row" key={doc.id}>
                              <div className="kb-document-name">
                                <span>
                                  <FiFileText />
                                </span>
                                <div>
                                  <button
                                    onClick={() =>
                                      setSelection({
                                        id: doc.id,
                                        name: doc.name,
                                      })
                                    }
                                  >
                                    {doc.name}
                                  </button>
                                  <small>
                                    {doc.sourceName ||
                                      (doc.sourceType === 'text'
                                        ? t("文本导入", "Pasted text")
                                        : t("文件导入", "Uploaded file"))}
                                  </small>
                                  {doc.status === 'failed' && (
                                    <p className="kb-document-error">
                                      {doc.error || t("索引失败，请重新索引。", "Indexing failed. Rebuild the index.")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <KnowledgeStatus
                                status={doc.status}
                                enabled={doc.enabled}
                              />
                              <span className="kb-doc-count">
                                {doc.chunkCount ?? '—'}
                                <small> {t("个分段", "chunks")}</small>
                              </span>
                              <time className="kb-doc-time">
                                {formatDate(doc.updatedAt)}
                              </time>
                              <div className="kb-document-actions">
                                <button
                                  className="btn-icon"
                                  title={t("查看分段", "View chunks")}
                                  aria-label={`查看 ${doc.name} 分段`}
                                  onClick={() =>
                                    setSelection({ id: doc.id, name: doc.name })
                                  }
                                >
                                  <FiBookOpen />
                                </button>
                                <button
                                  className="btn-icon"
                                  title={doc.enabled ? t("停用文档", "Disable document") : t("启用文档", "Enable document")}
                                  aria-label={`${doc.enabled ? t("停用", "Disable") : t("启用", "Enable")} ${doc.name}`}
                                  disabled={
                                    Boolean(pending) || !config?.configured
                                  }
                                  onClick={() => updateDocument(doc, 'toggle')}
                                >
                                  {doc.enabled ? <FiPause /> : <FiPlay />}
                                </button>
                                <button
                                  className="btn-icon"
                                  title={t("重新索引", "Reindex")}
                                  aria-label={`重新索引 ${doc.name}`}
                                  disabled={
                                    Boolean(pending) ||
                                    !config?.configured ||
                                    ['pending', 'indexing'].includes(doc.status)
                                  }
                                  onClick={() => updateDocument(doc, 'rebuild')}
                                >
                                  <FiRefreshCw
                                    className={
                                      pending === doc.id ? 'spinning' : ''
                                    }
                                  />
                                </button>
                                <button
                                  className="btn-icon btn-danger"
                                  title={t("删除文档", "Delete document")}
                                  aria-label={`删除 ${doc.name}`}
                                  disabled={Boolean(pending)}
                                  onClick={() => {
                                    setDialogError('');
                                    setDeleting(doc);
                                  }}
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            </article>
                          ))}
                        </section>
                      ) : (
                        <section className="surface empty-state kb-empty">
                          <span className="empty-state-icon">
                            <FiFileText />
                          </span>
                          <h2>
                            {query ? t("没有找到匹配的文档", "No matching documents") : t("给知识库添加内容", "Add content to this knowledge base")}
                          </h2>
                          <p>
                            {query
                              ? t("试试其他名称，或清空搜索条件。", "Try another name or clear the search.")
                              : t("上传文件或粘贴文本，预览分段后建立索引。", "Upload a file or paste text, preview the chunks and build the index.")}
                          </p>
                          <button
                            className="btn btn-primary"
                            disabled={!config?.configured}
                            onClick={() => setImporting(true)}
                          >
                            <FiPlus /> {t("导入文档", "Import documents")}
                          </button>
                        </section>
                      )}
                      <KnowledgePagination
                        page={page}
                        total={total}
                        loading={loading || Boolean(pending)}
                        onChange={setPage}
                      />
                    </>
                  )}
                  {tab === 'retrieval' && (
                    <RetrievalTest
                      key={id}
                      base={base}
                      configured={config?.configured}
                      onCitation={setSelection}
                    />
                  )}
                  {tab === 'settings' && (
                    <div className="kb-settings-layout">
                      <section className="surface kb-settings-form">
                        <h2>{t("知识库设置", "Knowledge base settings")}</h2>
                        <p className="kb-muted">
                          {t("默认分段参数用于新导入的文档；已有文档重新索引后应用新参数。", "New imports use these chunk settings. Reindex existing documents to apply them.")}
                        </p>
                        <BaseForm
                          key={`${base.id}-${base.updatedAt}`}
                          value={base}
                          config={config}
                          busy={Boolean(pending)}
                          onSave={saveBase}
                        />
                      </section>
                      <aside className="surface kb-maintenance">
                        <FiRefreshCw />
                        <h3>{t("重新索引文档", "Reindex documents")}</h3>
                        <p>
                          {t("文档检索异常时，可重新建立全部文档的索引。处理期间可能暂时无法检索。", "Rebuild all document indexes. Search may be temporarily unavailable during indexing.")}
                        </p>
                        <button
                          className="btn btn-default"
                          disabled={
                            Boolean(pending) ||
                            !config?.configured ||
                            !base.documentCount
                          }
                          onClick={() => {
                            setDialogError('');
                            setRebuilding(true);
                          }}
                        >
                          {t("重新索引全部文档", "Reindex all documents")}
                        </button>
                      </aside>
                    </div>
                  )}
                </section>
              </>
            )
          )}
        </>
      )}
      {importing && base && (
        <KnowledgeBaseImport
          base={base}
          config={config}
          onClose={() => setImporting(false)}
          onChanged={load}
          onImported={async () => {
            setImporting(false);
            await load();
            setSuccess(t("文档已导入并完成索引。", "Document imported and indexed."));
          }}
        />
      )}
      {selection && (
        <DocumentChunks
          key={selection.id}
          baseId={id}
          selection={selection}
          onClose={() => setSelection(null)}
        />
      )}
      {deleting && (
        <KnowledgeModal
          title={t("删除文档", "Delete document")}
          onClose={() => setDeleting(null)}
          busy={Boolean(pending)}
        >
          <p className="kb-confirm-text">
            {t("确定删除“", "Delete “")}{deleting.name}
            {t("”？文档和对应的分段索引将被移除，此操作无法撤销。", "” and its chunk index? This cannot be undone.")}
          </p>
          <KnowledgeError message={dialogError} />
          <div className="kb-modal-actions">
            <button
              className="btn btn-default"
              disabled={Boolean(pending)}
              onClick={() => setDeleting(null)}
            >
              {t("取消", "Cancel")}
            </button>
            <button
              className="btn kb-danger-button"
              disabled={Boolean(pending)}
              onClick={deleteDocument}
            >
              {pending ? t("正在删除", "Deleting") : t("确认删除", "Delete")}
            </button>
          </div>
        </KnowledgeModal>
      )}
      {rebuilding && base && (
        <KnowledgeModal
          title={t("重新索引全部文档", "Reindex all documents")}
          onClose={() => setRebuilding(false)}
          busy={Boolean(pending)}
        >
          <p className="kb-confirm-text">
            {t("将为“", "Rebuild all document indexes for “")}{base.name}
            {t("”中的全部文档重新建立索引，完成后可在列表中检查状态。", "”? Check indexing status in the list when finished.")}
          </p>
          <KnowledgeError message={dialogError} />
          <div className="kb-modal-actions">
            <button
              className="btn btn-default"
              disabled={Boolean(pending)}
              onClick={() => setRebuilding(false)}
            >
              {t("取消", "Cancel")}
            </button>
            <button
              className="btn btn-primary"
              disabled={Boolean(pending)}
              onClick={rebuildBase}
            >
              {pending ? t("正在重新索引", "Reindexing") : t("确认重新索引", "Reindex")}
            </button>
          </div>
        </KnowledgeModal>
      )}
    </main>
  );
}
