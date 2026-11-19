import { useEffect, useState } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import apiClient from '../../services/api';

export function isWorkflowAsset(url: string) {
  return /^\/api\/aiWorkflow\/assets\/[a-f0-9]{32}\.(png|jpg|jpeg|webp|mp3)$/.test(url);
}

export default function WorkflowAsset({ url, kind, alt = '' }: { url: string; kind: 'image' | 'audio'; alt?: string }) {
  const privateAsset = isWorkflowAsset(url);
  const [source, setSource] = useState(privateAsset ? '' : url);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setFailed(false);
    setSource(privateAsset ? '' : url);
    if (privateAsset) {
      // 私有素材通过带登录凭据的请求读取，不把登录令牌放入图片或下载链接。
      apiClient.get<Blob>(url, { responseType: 'blob', signal: controller.signal }).then(response => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(response.data);
        setSource(objectUrl);
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    }
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, privateAsset]);
  if (failed) return <p role="alert" className="result-inline-error">素材读取失败，请刷新任务后重试。</p>;
  if (!source) return <p role="status">正在读取素材…</p>;
  if (kind === 'audio') return <div className="result-audio"><audio controls preload="metadata" src={source} /><a className="text-action" href={source} target="_blank" rel="noreferrer">打开音频 <FiExternalLink /></a></div>;
  return <a href={source} target="_blank" rel="noreferrer"><img src={source} alt={alt} loading="lazy" /><span>打开原图 <FiExternalLink /></span></a>;
}
