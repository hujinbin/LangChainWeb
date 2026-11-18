import React, { useEffect, useState } from 'react';
import { agentAPI } from '../../services/agentApi';

export const isActive = (status?: string): boolean =>
  ['queued', 'running', 'cancelling'].includes(status || '');

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (
    !message ||
    /https?:\/\/|API_KEY|BASE_URL|Authorization|ECONN|Mongo|\bat\s+\S+\s*\(/i.test(
      message,
    )
  )
    return '操作暂时未完成，请稍后重试';
  return message;
}

const LABELS: Record<string, string> = {
  idle: '等待开始',
  pending: '等待生成',
  queued: '等待处理',
  running: '生成中',
  cancelling: '正在停止',
  completed: '已完成',
  failed: '未完成',
  cancelled: '已停止',
  interrupted: '已中断',
  stale: '待重新生成',
  designing: '正在构思分镜',
  image: '正在绘制画面',
  images: '正在绘制画面',
  video: '正在生成视频',
  submitting: '正在提交分镜',
  submitting_video: '正在提交分镜',
  polling: '正在生成视频',
  assembling: '正在合成成片',
};

export const statusLabel = (value?: string): string =>
  value ? LABELS[value] || '正在处理' : '等待开始';

export function AgentArtwork({
  kind,
}: {
  kind: 'comic' | 'life';
}): React.JSX.Element {
  return kind === 'comic' ? (
    <div className="agent-art agent-art-cloud" aria-hidden="true">
      <span className="agent-spark spark-one">✧</span>
      <span className="agent-spark spark-two">✦</span>
      <svg viewBox="0 0 320 200" role="presentation">
        <path
          fill="#fffdf0"
          stroke="#1b5643"
          strokeWidth="3"
          d="M87 139c-43-7-41-62-4-67 5-48 68-56 91-23 41-13 70 15 61 45 32 20 16 61-15 61H94Z"
        />
        <path
          fill="#84bea5"
          stroke="#1b5643"
          strokeWidth="3"
          d="m119 145 61-3 2 18-56 9-4-13-16 20-13-14Z"
        />
        <path
          stroke="#1b5643"
          strokeWidth="4"
          strokeLinecap="round"
          d="M127 103v8m48-8v8m-35 15q12 11 23-1"
        />
        <path
          fill="#e2a15b"
          stroke="#1b5643"
          strokeWidth="3"
          d="m197 135 15 30 23-7-12-28Z"
        />
        <path fill="none" stroke="#e2a15b" strokeWidth="4" d="m191 126 28-2" />
        <path stroke="#9cbdaa" strokeWidth="2" d="M32 170h48m164 8h36" />
      </svg>
      <span className="agent-art-caption">把小情绪，画成小故事。</span>
    </div>
  ) : (
    <div className="agent-art agent-art-life" aria-hidden="true">
      <span className="agent-film-edge top" />
      <span className="agent-film-edge bottom" />
      <div className="agent-life-window">
        <span className="agent-life-sun" />
        <span className="agent-life-person" />
        <span className="agent-life-horizon" />
      </div>
      <span className="agent-life-time">LIFE STORY / 一生的片段</span>
      <span className="agent-art-caption">如果人生，能够回看。</span>
    </div>
  );
}

export function AgentMedia({
  url,
  video = false,
  alt = '',
}: {
  url?: string;
  video?: boolean;
  alt?: string;
}): React.JSX.Element {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setSource('');
    setFailed(false);
    if (!url) return;
    if (/^https?:\/\//.test(url)) {
      setSource(url);
      return;
    }
    const controller = new AbortController();
    let local = '';
    agentAPI
      .asset(url, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        local = URL.createObjectURL(blob);
        setSource(local);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (local) URL.revokeObjectURL(local);
    };
  }, [url]);
  if (failed || !source)
    return (
      <div className="agent-media-empty">
        {failed
          ? '素材暂时无法读取'
          : url
            ? '正在载入素材…'
            : video
              ? '等待生成分镜视频'
              : '等待绘制画面'}
      </div>
    );
  return video ? (
    <video
      src={source}
      controls
      preload="metadata"
      aria-label={alt}
      onError={() => setFailed(true)}
    />
  ) : (
    <img
      src={source}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
