import { useLabels } from '../../store/languageStore';
import type { KnowledgeBase, KnowledgeConfig } from '../../types/knowledge';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiDatabase, FiRefreshCw, FiX } from 'react-icons/fi';

export type BaseFormValues = Pick<
  KnowledgeBase,
  | 'name'
  | 'description'
  | 'indexMode'
  | 'chunkSize'
  | 'chunkOverlap'
  | 'topK'
  | 'scoreThreshold'
  | 'enabled'
>;
type BaseDraft = Omit<
  Required<BaseFormValues>,
  'chunkSize' | 'chunkOverlap' | 'topK' | 'scoreThreshold'
> & {
  chunkSize: string | number;
  chunkOverlap: string | number;
  topK: string | number;
  scoreThreshold: string | number;
};


export const STATUS_LABELS: Record<string, string> = {
  pending: '待索引',
  indexing: '索引中',
  processing: '处理中',
  ready: '可检索',
  failed: '索引失败',
  empty: '等待文档',
  disabled: '已停用',
  enabled: '已启用',
};

export const formatDate = (value: string | number | Date | undefined | null) =>
  value
    ? new Date(value).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '暂无更新';

export function KnowledgeStatus({
  status,
  enabled = true,
}: {
  status?: string;
  enabled?: boolean;
}) {
  const t = useLabels();
  const value = enabled === false ? 'disabled' : status;
  return (
    <span className={`kb-status ${value || 'empty'}`}>
      <i />
      {STATUS_LABELS[value || ''] || status || t("等待文档", "Waiting for documents")}
    </span>
  );
}

export function KnowledgeError({
  message,
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  const t = useLabels();
  if (!message) return null;
  return (
    <div className="notice error kb-notice" role="alert">
      <span>{message}</span>
      {retry && (
        <button className="text-action" onClick={retry}>
          {t("重试", "Retry")}
        </button>
      )}
    </div>
  );
}

export function KnowledgeLoading({ text }: { text?: string }) {
  const t = useLabels();
  return (
    <div className="loading-state" role="status">
      <FiRefreshCw className="spinning" />
      {text ?? t("正在读取知识库", "Loading knowledge bases")}
    </div>
  );
}

export function KnowledgeLogin() {
  const t = useLabels();
  return (
    <section className="surface empty-state kb-empty">
      <span className="empty-state-icon">
        <FiDatabase />
      </span>
      <h2>{t("让知识，成为工作流的依据", "Add knowledge to your workflows")}</h2>
      <p>{t("登录后导入文档、管理知识库，检索内容并查看命中引用。", "Sign in to import documents, manage knowledge bases and inspect search results and citations.")}</p>
      <Link className="btn btn-primary" to="/login">
        {t("登录后使用", "Sign in")} <FiArrowRight />
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
}: {
  page: number;
  total: number | null;
  pageSize?: number;
  loading: boolean;
  onChange: (page: number) => void;
}) {
  const t = useLabels();
  if (total === null || total <= pageSize) return null;
  return (
    <div className="pagination kb-pagination">
      <button
        className="btn btn-default"
        disabled={page === 1 || loading}
        onClick={() => onChange(page - 1)}
      >
        {t("上一页", "Previous")}
      </button>
      <span>
        {t("第", "Page")} {page} / {Math.max(1, Math.ceil(total / pageSize))} {t("页 · 共", "· Total")} {total}{' '}
        {t("条", "items")}
      </span>
      <button
        className="btn btn-default"
        disabled={page * pageSize >= total || loading}
        onClick={() => onChange(page + 1)}
      >
        {t("下一页", "Next")}
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
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const t = useLabels();
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement;
    const root = panel.current;
    if (!root) return;
    const focusable = () => [
      ...root.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
      ),
    ];
    (focusable()[0] || root).focus();
    const onKey = (event: KeyboardEvent) => {
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
      if (previous instanceof HTMLElement) previous.focus();
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
            aria-label={t("关闭弹窗", "Close dialog")}
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
  submitLabel,
}: {
  value?: Partial<KnowledgeBase>;
  config: KnowledgeConfig | null;
  busy?: boolean;
  onSave: (value: BaseFormValues) => void;
  submitLabel?: string;
}) {
  const t = useLabels();
  const formId = useId();
  const [draft, setDraft] = useState<BaseDraft>({
    name: '',
    description: '',
    indexMode: config?.defaultMode || 'bm25',
    chunkSize: 800,
    chunkOverlap: 100,
    topK: 5,
    scoreThreshold: 0,
    enabled: true,
    ...config?.defaults,
    ...value,
  });
  const [error, setError] = useState('');
  const field = (name: keyof BaseDraft, next: string | boolean) =>
    setDraft((current) => ({ ...current, [name]: next }));
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (Number(draft.chunkOverlap) >= Number(draft.chunkSize)) {
      setError(t("分段重叠字数需要小于分段长度。", "Overlap must be smaller than chunk length."));
      return;
    }
    setError('');
    onSave({
      name: draft.name.trim(),
      description: (draft.description || '').trim(),
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
        {t("知识库名称", "Knowledge base name")} <span className="kb-required">*</span>
        <input
          id={`${formId}-name`}
          value={draft.name}
          onChange={(event) => field('name', event.target.value)}
          required
          maxLength={100}
          placeholder={t("例如：产品使用手册", "For example, Product guide")}
          disabled={busy}
        />
      </label>
      <label htmlFor={`${formId}-description`}>
        {t("知识库描述", "Description")}
        <textarea
          id={`${formId}-description`}
          value={draft.description}
          onChange={(event) => field('description', event.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={t("说明文档的用途与范围，方便在工作流中选择", "Describe the purpose and scope of these documents")}
          disabled={busy}
        />
      </label>
      <label htmlFor={`${formId}-mode`}>
        {t("检索方式", "Retrieval method")}
        <select
          id={`${formId}-mode`}
          aria-label={t("检索方式", "Retrieval method")}
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
          <option value="bm25">{t("关键词检索 · BM25", "Keyword search · BM25")}</option>
          {(config?.modes?.includes('dense') ||
            draft.indexMode === 'dense') && (
            <option value="dense" disabled={!config?.modes?.includes('dense')}>
              {t("语义向量检索", "Semantic vector search")}
            </option>
          )}
        </select>
        <small>
          {draft.indexMode === 'bm25'
            ? t("按关键词检索，得分用于排序；建库后检索方式固定。", "Ranks results by keyword match. The method is fixed when the base is created.")
            : t("按文本语义检索，使用已配置的向量模型。", "Finds related passages with the configured embedding model.")}
        </small>
      </label>
      <div className="kb-form-grid">
        <label htmlFor={`${formId}-size`}>
          {t("默认分段长度", "Default chunk length")}
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
          <small>{t("100–4000 字符", "100–4000 characters")}</small>
        </label>
        <label htmlFor={`${formId}-overlap`}>
          {t("分段重叠字数", "Chunk overlap")}
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
          <small>{t("保留相邻分段的上下文", "Keep context between adjacent chunks")}</small>
        </label>
      </div>
      <div className="kb-form-grid">
        <label htmlFor={`${formId}-topk`}>
          {t("默认命中数量", "Default result count")}
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
          {t("最低检索得分", "Minimum score")}
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
          {t("启用知识库", "Enable knowledge base")}<small>{t("停用后，工作流无法检索此库。", "Disabled knowledge bases cannot be searched by workflows.")}</small>
        </span>
      </label>
      <KnowledgeError message={error} />
      <div className="kb-form-footer">
        <button
          className="btn btn-primary"
          disabled={busy || !draft.name.trim()}
        >
          {busy && <FiRefreshCw className="spinning" />}
          {busy ? t("正在保存", "Saving") : submitLabel ?? t("保存知识库", "Save knowledge base")}
        </button>
      </div>
    </form>
  );
}
