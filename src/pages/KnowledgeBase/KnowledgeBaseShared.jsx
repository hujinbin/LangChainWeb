import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiDatabase, FiRefreshCw, FiX } from 'react-icons/fi';

export const STATUS_LABELS = {
  pending: '待索引',
  indexing: '索引中',
  processing: '处理中',
  ready: '可检索',
  failed: '索引失败',
  empty: '等待文档',
  disabled: '已停用',
  enabled: '已启用',
};

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '暂无更新';

export function KnowledgeStatus({ status, enabled = true }) {
  const value = enabled === false ? 'disabled' : status;
  return (
    <span className={`kb-status ${value || 'empty'}`}>
      <i />
      {STATUS_LABELS[value] || status || '等待文档'}
    </span>
  );
}

export function KnowledgeError({ message, retry }) {
  if (!message) return null;
  return (
    <div className="notice error kb-notice" role="alert">
      <span>{message}</span>
      {retry && (
        <button className="text-action" onClick={retry}>
          重试
        </button>
      )}
    </div>
  );
}

export function KnowledgeLoading({ text = '正在读取知识库' }) {
  return (
    <div className="loading-state" role="status">
      <FiRefreshCw className="spinning" />
      {text}
    </div>
  );
}

export function KnowledgeLogin() {
  return (
    <section className="surface empty-state kb-empty">
      <span className="empty-state-icon">
        <FiDatabase />
      </span>
      <h2>让知识，成为工作流的依据</h2>
      <p>登录后导入文档、管理知识库，检索内容并查看命中引用。</p>
      <Link className="btn btn-primary" to="/login">
        登录后使用 <FiArrowRight />
      </Link>
    </section>
  );
}

export function KnowledgePagination({
  page,
  total,
  pageSize = 20,
  loading,
  onChange,
}) {
  if (total <= pageSize) return null;
  return (
    <div className="pagination kb-pagination">
      <button
        className="btn btn-default"
        disabled={page === 1 || loading}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </button>
      <span>
        第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页 · 共 {total}{' '}
        条
      </span>
      <button
        className="btn btn-default"
        disabled={page * pageSize >= total || loading}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}

export function KnowledgeModal({
  title,
  description,
  children,
  onClose,
  busy = false,
  wide = false,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement;
    const root = panel.current;
    const focusable = () => [
      ...root.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
      ),
    ];
    (focusable()[0] || root).focus();
    const onKey = (event) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        root.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === root)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="kb-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={panel}
        tabIndex={-1}
        className={`kb-modal ${wide ? 'kb-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="kb-modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            type="button"
            className="btn-icon"
            aria-label="关闭弹窗"
            disabled={busy}
            onClick={onClose}
          >
            <FiX />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function BaseForm({
  value = {},
  config,
  busy,
  onSave,
  submitLabel = '保存知识库',
}) {
  const formId = useId();
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    indexMode: 'bm25',
    chunkSize: 800,
    chunkOverlap: 100,
    topK: 5,
    scoreThreshold: 0,
    enabled: true,
    ...config?.defaults,
    ...value,
  });
  const [error, setError] = useState('');
  const field = (name, next) =>
    setDraft((current) => ({ ...current, [name]: next }));
  const submit = (event) => {
    event.preventDefault();
    if (Number(draft.chunkOverlap) >= Number(draft.chunkSize)) {
      setError('分段重叠字数需要小于分段长度。');
      return;
    }
    setError('');
    onSave({
      name: draft.name.trim(),
      description: draft.description.trim(),
      indexMode: draft.indexMode,
      chunkSize: Number(draft.chunkSize),
      chunkOverlap: Number(draft.chunkOverlap),
      topK: Number(draft.topK),
      scoreThreshold: Number(draft.scoreThreshold),
      enabled: draft.enabled,
    });
  };
  return (
    <form className="kb-form" onSubmit={submit}>
      <label htmlFor={`${formId}-name`}>
        知识库名称 <span className="kb-required">*</span>
        <input
          id={`${formId}-name`}
          value={draft.name}
          onChange={(event) => field('name', event.target.value)}
          required
          maxLength={100}
          placeholder="例如：产品使用手册"
          disabled={busy}
        />
      </label>
      <label htmlFor={`${formId}-description`}>
        知识库描述
        <textarea
          id={`${formId}-description`}
          value={draft.description}
          onChange={(event) => field('description', event.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="说明文档的用途与范围，方便在工作流中选择"
          disabled={busy}
        />
      </label>
      <label htmlFor={`${formId}-mode`}>
        检索方式
        <select
          id={`${formId}-mode`}
          aria-label="检索方式"
          value={draft.indexMode}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              indexMode: event.target.value,
              scoreThreshold: 0,
            }))
          }
          disabled={busy || Boolean(value.id)}
        >
          <option value="bm25">关键词检索 · BM25</option>
          {(config?.modes?.includes('dense') ||
            draft.indexMode === 'dense') && (
            <option value="dense" disabled={!config?.modes?.includes('dense')}>
              语义向量检索
            </option>
          )}
        </select>
        <small>
          {draft.indexMode === 'bm25'
            ? '按关键词检索，得分用于排序；建库后检索方式固定。'
            : '按文本语义检索，使用已配置的向量模型。'}
        </small>
      </label>
      <div className="kb-form-grid">
        <label htmlFor={`${formId}-size`}>
          默认分段长度
          <input
            id={`${formId}-size`}
            type="number"
            min={100}
            max={4000}
            step={1}
            required
            value={draft.chunkSize}
            onChange={(event) => field('chunkSize', event.target.value)}
            disabled={busy}
          />
          <small>100–4000 字符</small>
        </label>
        <label htmlFor={`${formId}-overlap`}>
          分段重叠字数
          <input
            id={`${formId}-overlap`}
            type="number"
            min={0}
            max={Math.min(1000, Number(draft.chunkSize) - 1)}
            step={1}
            required
            value={draft.chunkOverlap}
            onChange={(event) => field('chunkOverlap', event.target.value)}
            disabled={busy}
          />
          <small>保留相邻分段的上下文</small>
        </label>
      </div>
      <div className="kb-form-grid">
        <label htmlFor={`${formId}-topk`}>
          默认命中数量
          <input
            id={`${formId}-topk`}
            type="number"
            min={1}
            max={20}
            step={1}
            required
            value={draft.topK}
            onChange={(event) => field('topK', event.target.value)}
            disabled={busy}
          />
        </label>
        <label htmlFor={`${formId}-score`}>
          最低检索得分
          <input
            id={`${formId}-score`}
            type="number"
            min={0}
            max={draft.indexMode === 'dense' ? 1 : 10000}
            step={0.01}
            required
            value={draft.scoreThreshold}
            onChange={(event) => field('scoreThreshold', event.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      <label className="kb-check">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => field('enabled', event.target.checked)}
          disabled={busy}
        />
        <span>
          启用知识库<small>停用后，工作流无法检索此库。</small>
        </span>
      </label>
      <KnowledgeError message={error} />
      <div className="kb-form-footer">
        <button
          className="btn btn-primary"
          disabled={busy || !draft.name.trim()}
        >
          {busy && <FiRefreshCw className="spinning" />}
          {busy ? '正在保存' : submitLabel}
        </button>
      </div>
    </form>
  );
}
