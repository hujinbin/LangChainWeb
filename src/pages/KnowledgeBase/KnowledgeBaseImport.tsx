import type { ImportPreview, KnowledgeBase, KnowledgeConfig, KnowledgeDocument, KnowledgeImportInput } from '../../types/knowledge';
import { normalizeError } from '../../types/api';
import React, { useRef, useState } from 'react';
import {
  FiCheck,
  FiFileText,
  FiRefreshCw,
  FiUploadCloud,
} from 'react-icons/fi';
import { knowledgeAPI } from '../../services/knowledgeApi';
import { KnowledgeError, KnowledgeModal } from './KnowledgeBaseShared';

interface KnowledgeBaseImportProps {
  base: KnowledgeBase;
  config: KnowledgeConfig | null;
  onClose: () => void;
  onImported: (document: KnowledgeDocument) => void | Promise<void>;
  onChanged: () => void | Promise<void>;
}


export default function KnowledgeBaseImport({
  base,
  config,
  onClose,
  onImported,
  onChanged,
}: KnowledgeBaseImportProps) {
  const [mode, setMode] = useState('file');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState<number | string>(base.chunkSize || 800);
  const [chunkOverlap, setChunkOverlap] = useState<number | string>(base.chunkOverlap ?? 100);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [savedDocument, setSavedDocument] = useState<KnowledgeDocument | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const types = config?.acceptedFileTypes || ['txt', 'md', 'pdf', 'docx'];
  const maxBytes = config?.maxFileBytes || 10485760;
  const ready =
    name.trim() && (mode === 'file' ? Boolean(file) : Boolean(text.trim()));
  const change = <T,>(setter: (next: T) => void, value: T) => {
    setter(value);
    setPreview(null);
    setError('');
  };
  const selectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    setPreview(null);
    setError('');
    setFile(null);
    if (!selected) return;
    if (selected.size > maxBytes) {
      setError(`文件不能超过 ${Math.round(maxBytes / 1024 / 1024)} MB。`);
      event.target.value = '';
      return;
    }
    if (!types.includes((selected.name.split('.').pop() || '').toLowerCase())) {
      setError('暂不支持此文件格式，请选择支持的文档。');
      event.target.value = '';
      return;
    }
    setFile(selected);
    setName(selected.name.slice(0, 100));
  };
  const payload = (): KnowledgeImportInput | FormData => {
    if (mode === 'text')
      return {
        name: name.trim(),
        text,
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(chunkOverlap),
      };
    const data = new FormData();
    if (!file) throw new Error('请选择导入文件');
    data.append('file', file);
    data.append('name', name.trim());
    data.append('chunkSize', String(chunkSize));
    data.append('chunkOverlap', String(chunkOverlap));
    return data;
  };
  const run = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || savedDocument) return;
    if (Number(chunkOverlap) >= Number(chunkSize)) {
      setError('分段重叠字数需要小于分段长度。');
      return;
    }
    setBusy(preview ? 'import' : 'preview');
    setError('');
    try {
      if (preview) {
        const response = await knowledgeAPI.importDocument(base.id, payload());
        if (response.data?.status !== 'ready') {
          setSavedDocument(response.data);
          await onChanged();
          setError(
            response.data?.status === 'failed'
              ? '文档已保存，但索引失败。可关闭弹窗后重新索引。'
              : '文档已保存，索引尚未完成。请返回文档列表查看状态。',
          );
          return;
        }
        await onImported(response.data);
      } else {
        const response = await knowledgeAPI.preview(base.id, payload());
        if (!response.data?.totalChunks) {
          setError('未解析出可导入的内容，请检查文档。');
          return;
        }
        setPreview(response.data);
      }
    } catch (caughtError) {
      const err = normalizeError(caughtError);
      setError(err.message || '文档处理失败，请重试');
      const saved = err.data?.document || err.response?.data?.data?.document;
      if (saved) setSavedDocument(saved);
      if (preview) await onChanged();
    } finally {
      setBusy('');
    }
  };
  return (
    <KnowledgeModal
      title="导入文档"
      description="先检查分段效果，再导入并建立索引。"
      wide
      onClose={onClose}
      busy={Boolean(busy)}
    >
      <form className="kb-form" onSubmit={run}>
        <div className="kb-segmented" aria-label="导入方式">
          <button
            type="button"
            aria-pressed={mode === 'file'}
            className={mode === 'file' ? 'active' : ''}
            disabled={Boolean(busy)}
            onClick={() => change(setMode, 'file')}
          >
            <FiUploadCloud /> 上传文件
          </button>
          <button
            type="button"
            aria-pressed={mode === 'text'}
            className={mode === 'text' ? 'active' : ''}
            disabled={Boolean(busy)}
            onClick={() => change(setMode, 'text')}
          >
            <FiFileText /> 粘贴文本
          </button>
        </div>
        {mode === 'file' ? (
          <div className="kb-upload">
            <FiUploadCloud />
            <strong>{file?.name || '选择一份文档'}</strong>
            <p>
              {types.map((type) => type.toUpperCase()).join('、')} ·
              单个文件不超过 {Math.round(maxBytes / 1024 / 1024)} MB
            </p>
            <input
              id="kb-import-file"
              ref={fileInput}
              type="file"
              accept={types.map((type) => `.${type}`).join(',')}
              aria-label="选择导入文件"
              onChange={selectFile}
              disabled={Boolean(busy)}
            />
          </div>
        ) : (
          <label htmlFor="kb-import-text">
            文档内容
            <textarea
              id="kb-import-text"
              aria-label="文档内容"
              rows={7}
              value={text}
              onChange={(event) => change(setText, event.target.value)}
              placeholder="粘贴需要检索的文本内容…"
              maxLength={1000000}
              required
              disabled={Boolean(busy)}
            />
            <small>{text.length.toLocaleString()} / 1,000,000 字符</small>
          </label>
        )}
        <label htmlFor="kb-import-name">
          文档名称 <span className="kb-required">*</span>
          <input
            id="kb-import-name"
            maxLength={100}
            required
            value={name}
            onChange={(event) => change(setName, event.target.value)}
            placeholder="给文档一个容易识别的名称"
            disabled={Boolean(busy)}
          />
        </label>
        <div className="kb-form-grid">
          <label htmlFor="kb-import-size">
            分段长度
            <input
              id="kb-import-size"
              type="number"
              min={100}
              max={4000}
              step={1}
              required
              value={chunkSize}
              onChange={(event) => change(setChunkSize, event.target.value)}
              disabled={Boolean(busy)}
            />
            <small>100–4000 字符</small>
          </label>
          <label htmlFor="kb-import-overlap">
            重叠字数
            <input
              id="kb-import-overlap"
              type="number"
              min={0}
              max={Math.min(1000, Number(chunkSize) - 1)}
              step={1}
              required
              value={chunkOverlap}
              onChange={(event) => change(setChunkOverlap, event.target.value)}
              disabled={Boolean(busy)}
            />
            <small>小于分段长度，最多 1000 字符</small>
          </label>
        </div>
        <KnowledgeError message={error} />
        {preview && (
          <section className="kb-preview" aria-label="分段预览">
            <header>
              <h3>
                <FiCheck /> 分段预览
              </h3>
              <span>
                {preview.totalChunks} 个分段 ·{' '}
                {preview.totalCharacters?.toLocaleString()} 字符
              </span>
            </header>
            <div className="kb-preview-chunks">
              {preview.chunks.map((chunk) => (
                <article className="kb-chunk" key={chunk.index}>
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
            {preview.totalChunks > preview.chunks.length && (
              <p className="kb-muted">
                当前预览前 {preview.chunks.length}{' '}
                个分段，导入时将处理全部内容。
              </p>
            )}
          </section>
        )}
        <footer className="kb-modal-actions kb-import-actions">
          <button
            type="button"
            className="btn btn-default"
            onClick={onClose}
            disabled={Boolean(busy)}
          >
            取消
          </button>
          {savedDocument ? (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              返回文档列表
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={Boolean(busy) || !ready}
            >
              {busy ? (
                <FiRefreshCw className="spinning" />
              ) : preview ? (
                <FiUploadCloud />
              ) : (
                <FiFileText />
              )}
              {busy === 'preview'
                ? '正在解析分段'
                : busy === 'import'
                  ? '正在导入并索引'
                  : preview
                    ? '确认导入并索引'
                    : '预览分段'}
            </button>
          )}
        </footer>
      </form>
    </KnowledgeModal>
  );
}
