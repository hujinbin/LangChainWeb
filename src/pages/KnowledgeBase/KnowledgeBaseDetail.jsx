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

function DocumentChunks({ baseId, selection, onClose }) {
  const [page, setPage] = useState(selection.page || 1);
  const [data, setData] = useState(null);
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
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.message || '读取文档分段失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [baseId, selection.id, page, revision]);
  return (
    <KnowledgeModal
      title={selection.name || '文档分段'}
      description="查看实际保存的文档分段与引用内容。"
      wide
      onClose={onClose}
    >
      <KnowledgeError message={error} retry={() => setRevision(revision + 1)} />
      {loading ? (
        <KnowledgeLoading text="正在读取文档分段" />
      ) : (
        data && (
          <>
            <div className="kb-chunks-summary">
              <KnowledgeStatus status={data.status} enabled={data.enabled} />
              <span>{data.totalChunks ?? data.chunkCount} 个分段</span>
            </div>
            {data.chunks?.length ? (
              <div className="kb-document-chunks">
                {data.chunks.map((chunk) => (
                  <article
                    className={`kb-chunk ${selection.chunkIndex === chunk.index ? 'kb-chunk-highlight' : ''}`}
                    key={chunk.id || chunk.index}
                  >
                    <div>
                      <b>分段 {chunk.index + 1}</b>
                      <small>
                        {chunk.characters ?? chunk.content.length} 字符
                      </small>
                    </div>
                    <p>{chunk.content}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="kb-muted">文档暂无可查看的分段，请检查索引状态。</p>
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

function RetrievalTest({ base, configured, onCitation }) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(base.topK || 5);
  const [scoreThreshold, setScoreThreshold] = useState(
    base.scoreThreshold || 0,
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const retrieve = async (event) => {
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
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err.message || '检索失败，请重试');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <section className="kb-retrieval-layout">
      <form className="surface kb-retrieval-form kb-form" onSubmit={retrieve}>
        <span className="kb-section-label">检索测试</span>
        <h2>这份知识，能回答什么？</h2>
        <p className="kb-muted">使用真实文档检索，检查命中内容与引用。</p>
        <label htmlFor="kb-retrieve-query">
          检索问题
          <textarea
            id="kb-retrieve-query"
            rows={6}
            required
            maxLength={6000}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：产品支持哪些文件格式？"
            disabled={loading}
          />
        </label>
        <div className="kb-form-grid">
          <label htmlFor="kb-retrieve-topk">
            命中数量
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
            最低检索得分
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
            {base.indexMode === 'dense' ? '语义向量检索' : '关键词检索 · BM25'}
            <small>
              {base.indexMode === 'dense'
                ? '按文本语义查找相关内容。'
                : '检索得分用于排序，不代表语义相似率。'}
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
          {loading ? '正在检索' : '开始检索'}
        </button>
        {base.enabled === false && (
          <p className="kb-muted">知识库已停用，请在设置中启用后测试。</p>
        )}
        <KnowledgeError message={error} />
      </form>
      <div className="kb-retrieval-results" aria-live="polite">
        {loading ? (
          <KnowledgeLoading text="正在检索相关文档" />
        ) : result ? (
          <>
            <header className="kb-results-heading">
              <h2>
                检索结果 <span>{result.documents?.length || 0}</span>
              </h2>
              <p>问题：{result.query}</p>
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
                        {hit.title || hit.sourceName || '文档引用'}
                      </strong>
                      <small>分段 {Number(hit.chunkIndex || 0) + 1}</small>
                    </div>
                    <span className="kb-score">
                      得分{' '}
                      {Number.isFinite(hit.score) ? hit.score.toFixed(4) : '—'}
                    </span>
                  </header>
                  <p>{hit.content}</p>
                  <footer>
                    <FiFileText />
                    <span>{hit.sourceName || hit.title || '文档'}</span>
                    {hit.documentId && (
                      <button
                        className="text-action"
                        onClick={() =>
                          onCitation({
                            id: hit.documentId,
                            name: hit.title || hit.sourceName,
                            chunkIndex: hit.chunkIndex,
                            page:
                              Math.floor(Number(hit.chunkIndex || 0) / 20) + 1,
                          })
                        }
                      >
                        查看引用 <FiArrowUpRight />
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
                <h3>未找到命中内容</h3>
                <p>
                  尝试更具体的关键词、降低最低得分，或确认文档已启用并完成索引。
                </p>
              </section>
            )}
          </>
        ) : (
          <section className="kb-test-placeholder">
            <span>
              <FiSearch />
            </span>
            <h3>先问一个问题</h3>
            <p>命中的文档分段与原文引用，会显示在这里。</p>
          </section>
        )}
      </div>
    </section>
  );
}

export default function KnowledgeBaseDetail() {
  const { id } = useParams();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [base, setBase] = useState(null);
  const [config, setConfig] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('documents');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState('');
  const [importing, setImporting] = useState(false);
  const [selection, setSelection] = useState(null);
  const [deleting, setDeleting] = useState(null);
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
      } catch (err) {
        if (version === requestVersion.current)
          setError(err.message || '读取知识库详情失败');
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    },
    [id, isLoggedIn, page, query],
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
  const updateDocument = async (document, action) => {
    setPending(document.id);
    setError('');
    setSuccess('');
    try {
      if (action === 'rebuild') {
        const response = await knowledgeAPI.rebuildDocument(id, document.id);
        if (response.data?.status === 'failed')
          throw new Error('文档索引失败，请稍后重试');
      } else
        await knowledgeAPI.updateDocument(id, document.id, {
          enabled: !document.enabled,
        });
      await load();
      setSuccess(
        action === 'rebuild'
          ? '文档索引已更新。'
          : document.enabled
            ? '文档已停用。'
            : '文档已启用。',
      );
    } catch (err) {
      await load();
      setError(err.message || '更新文档失败，请重试');
    } finally {
      setPending('');
    }
  };
  const deleteDocument = async () => {
    setPending(deleting.id);
    setDialogError('');
    setSuccess('');
    try {
      await knowledgeAPI.deleteDocument(id, deleting.id);
      setDeleting(null);
      if (documents.length === 1 && page > 1) setPage(page - 1);
      else await load();
      setSuccess('文档已删除。');
    } catch (err) {
      setDialogError(err.message || '删除文档失败');
    } finally {
      setPending('');
    }
  };
  const saveBase = async (values) => {
    setPending('settings');
    setError('');
    setSuccess('');
    try {
      await knowledgeAPI.update(id, values);
      await load();
      setSuccess('知识库设置已保存。');
    } catch (err) {
      setError(err.message || '保存设置失败，请重试');
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
      setSuccess('知识库索引已更新。');
    } catch (err) {
      await load();
      setDialogError(err.message || '重新索引失败，请重试');
    } finally {
      setPending('');
    }
  };
  return (
    <main className="page-wrap kb-page kb-detail-page">
      <Link className="record-back" to="/knowledge">
        <FiArrowLeft /> 返回知识库
      </Link>
      <header className="page-heading">
        <div>
          <span className="eyebrow">KNOWLEDGE COLLECTION</span>
          <h1>{base?.name || '知识库详情'}</h1>
          <p>{base?.description || '管理文档、检查索引并测试检索效果。'}</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={
            !isLoggedIn || !base || !config?.configured || Boolean(pending)
          }
          onClick={() => setImporting(true)}
        >
          <FiPlus /> 导入文档
        </button>
      </header>
      {!isLoggedIn ? (
        <KnowledgeLogin />
      ) : (
        <>
          {config?.configured === false && (
            <div className="notice kb-notice" role="status">
              知识库服务尚未配置。请联系管理员开通后导入文档与检索。
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
                        ? '语义向量检索'
                        : '关键词检索 · BM25'}
                    </span>
                  </div>
                  <div className="kb-summary-metric">
                    <FiFileText />
                    <strong>{base.documentCount ?? '—'}</strong>
                    <span>份文档</span>
                  </div>
                  <div className="kb-summary-metric">
                    <FiLayers />
                    <strong>{base.chunkCount ?? '—'}</strong>
                    <span>个分段</span>
                  </div>
                  <small>更新于 {formatDate(base.updatedAt)}</small>
                </section>
                <div
                  className="kb-tabs"
                  role="tablist"
                  aria-label="知识库管理"
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
                  {[
                    ['documents', FiFileText, '文档'],
                    ['retrieval', FiSearch, '检索测试'],
                    ['settings', FiSettings, '设置'],
                  ].map(([value, Icon, label]) => (
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
                          文档管理 <small>{total}</small>
                        </span>
                        <label className="kb-search">
                          <FiSearch />
                          <input
                            aria-label="搜索文档"
                            value={query}
                            placeholder="搜索文档名称"
                            disabled={Boolean(pending)}
                            onChange={(event) => {
                              setQuery(event.target.value);
                              setPage(1);
                            }}
                          />
                        </label>
                        <button
                          className="btn-icon"
                          aria-label="刷新文档"
                          disabled={loading || Boolean(pending)}
                          onClick={load}
                        >
                          <FiRefreshCw className={loading ? 'spinning' : ''} />
                        </button>
                      </div>
                      {loading ? (
                        <KnowledgeLoading text="正在读取文档" />
                      ) : documents.length ? (
                        <section
                          className="surface kb-document-list"
                          aria-label="知识库文档"
                        >
                          <div className="kb-doc-table-heading">
                            <span>文档名称</span>
                            <span>索引状态</span>
                            <span>分段</span>
                            <span>更新时间</span>
                            <span>操作</span>
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
                                        ? '文本导入'
                                        : '文件导入')}
                                  </small>
                                  {doc.status === 'failed' && (
                                    <p className="kb-document-error">
                                      {doc.error || '索引失败，请重新索引。'}
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
                                <small> 个分段</small>
                              </span>
                              <time className="kb-doc-time">
                                {formatDate(doc.updatedAt)}
                              </time>
                              <div className="kb-document-actions">
                                <button
                                  className="btn-icon"
                                  title="查看分段"
                                  aria-label={`查看 ${doc.name} 分段`}
                                  onClick={() =>
                                    setSelection({ id: doc.id, name: doc.name })
                                  }
                                >
                                  <FiBookOpen />
                                </button>
                                <button
                                  className="btn-icon"
                                  title={doc.enabled ? '停用文档' : '启用文档'}
                                  aria-label={`${doc.enabled ? '停用' : '启用'} ${doc.name}`}
                                  disabled={
                                    Boolean(pending) || !config?.configured
                                  }
                                  onClick={() => updateDocument(doc, 'toggle')}
                                >
                                  {doc.enabled ? <FiPause /> : <FiPlay />}
                                </button>
                                <button
                                  className="btn-icon"
                                  title="重新索引"
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
                                  title="删除文档"
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
                            {query ? '没有找到匹配的文档' : '给知识库添加内容'}
                          </h2>
                          <p>
                            {query
                              ? '试试其他名称，或清空搜索条件。'
                              : '上传文件或粘贴文本，预览分段后建立索引。'}
                          </p>
                          <button
                            className="btn btn-primary"
                            disabled={!config?.configured}
                            onClick={() => setImporting(true)}
                          >
                            <FiPlus /> 导入文档
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
                        <h2>知识库设置</h2>
                        <p className="kb-muted">
                          默认分段参数用于新导入的文档；已有文档重新索引后应用新参数。
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
                        <h3>重新索引文档</h3>
                        <p>
                          文档检索异常时，可重新建立全部文档的索引。处理期间可能暂时无法检索。
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
                          重新索引全部文档
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
            setSuccess('文档已导入并完成索引。');
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
          title="删除文档"
          onClose={() => setDeleting(null)}
          busy={Boolean(pending)}
        >
          <p className="kb-confirm-text">
            确定删除“{deleting.name}
            ”？文档和对应的分段索引将被移除，此操作无法撤销。
          </p>
          <KnowledgeError message={dialogError} />
          <div className="kb-modal-actions">
            <button
              className="btn btn-default"
              disabled={Boolean(pending)}
              onClick={() => setDeleting(null)}
            >
              取消
            </button>
            <button
              className="btn kb-danger-button"
              disabled={Boolean(pending)}
              onClick={deleteDocument}
            >
              {pending ? '正在删除' : '确认删除'}
            </button>
          </div>
        </KnowledgeModal>
      )}
      {rebuilding && (
        <KnowledgeModal
          title="重新索引全部文档"
          onClose={() => setRebuilding(false)}
          busy={Boolean(pending)}
        >
          <p className="kb-confirm-text">
            将为“{base.name}
            ”中的全部文档重新建立索引，完成后可在列表中检查状态。
          </p>
          <KnowledgeError message={dialogError} />
          <div className="kb-modal-actions">
            <button
              className="btn btn-default"
              disabled={Boolean(pending)}
              onClick={() => setRebuilding(false)}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              disabled={Boolean(pending)}
              onClick={rebuildBase}
            >
              {pending ? '正在重新索引' : '确认重新索引'}
            </button>
          </div>
        </KnowledgeModal>
      )}
    </main>
  );
}
