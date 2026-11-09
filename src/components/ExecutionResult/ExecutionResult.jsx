import React, { useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiChevronDown,
  FiExternalLink,
  FiRefreshCw,
  FiCopy,
} from 'react-icons/fi';
import { mediaAPI } from '../../services/api';
import './ExecutionResult.css';

const LABELS = {
  success: '执行成功',
  failed: '执行失败',
  running: '正在运行',
  queued: '排队中',
  in_progress: '生成中',
  completed: '视频已完成',
};

function mediaUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function normalizeVideo(data) {
  let task = data || {};
  for (let depth = 0; depth < 3; depth++) {
    if (!task || typeof task !== 'object') {
      throw new Error('视频服务返回的数据格式有误');
    }
    if (
      task.code !== undefined &&
      ![200, 201, 202].includes(Number(task.code))
    ) {
      throw new Error(task.msg || task.message || '视频任务查询失败');
    }
    if (task.success === false) {
      throw new Error(task.msg || task.message || '视频任务查询失败');
    }
    if (task.data && !task.status) task = task.data;
    else break;
  }
  const statuses = {
    pending: 'queued',
    processing: 'in_progress',
    running: 'in_progress',
    succeeded: 'completed',
    success: 'completed',
    done: 'completed',
    error: 'failed',
    canceled: 'failed',
    cancelled: 'failed',
  };
  const status = statuses[task.status] || task.status;
  if (!['queued', 'in_progress', 'completed', 'failed'].includes(status)) {
    throw new Error(task.msg || task.message || '视频服务未返回有效的任务状态');
  }
  const videoUrl = mediaUrl(task.video_url || task.videoUrl || task.url);
  if (status === 'completed' && !videoUrl) {
    throw new Error('视频任务已完成，但尚未取得有效的视频地址');
  }
  return {
    status,
    videoUrl: status === 'completed' ? videoUrl : '',
    error:
      status === 'failed'
        ? typeof task.error === 'string'
          ? task.error
          : task.error?.message || task.message || '视频生成失败'
        : '',
    progress: task.progress,
  };
}

function NodeOutput({ output, simulated }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setTask(null);
    setError('');
    setCopied(false);
  }, [output]);
  if (!output) return null;
  const video = { ...output, ...task };
  const videoId = output.videoId;
  const videoSrc = mediaUrl(video.videoUrl);
  const imageUrls = [
    ...new Set(
      (
        output.urls ||
        output.images?.map((item) =>
          typeof item === 'string' ? item : item.url
        ) ||
        []
      )
        .map(mediaUrl)
        .filter(Boolean)
    ),
  ];
  const queryTask = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await mediaAPI.queryVideo(videoId);
      setTask(normalizeVideo(response));
    } catch (err) {
      setError(err.message || '查询视频任务失败');
    } finally {
      setLoading(false);
    }
  };
  const copyTaskId = async () => {
    try {
      await navigator.clipboard.writeText(videoId);
      setCopied(true);
    } catch {
      setError('复制失败，请手动选择任务 ID 复制');
    }
  };
  return (
    <div className="result-node-output">
      {output.text && <div className="result-text">{output.text}</div>}
      {imageUrls.length > 0 && (
        <div className="result-images">
          {imageUrls.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt={`生成图片 ${index + 1}`} loading="lazy" />
              <span>
                打开原图 <FiExternalLink />
              </span>
            </a>
          ))}
        </div>
      )}
      {videoId && (
        <div className="result-video-task">
          <div className="result-task-heading">
            <span
              className={`badge ${video.status === 'failed' ? 'failed' : video.status === 'completed' ? 'success' : 'running'}`}
            >
              {LABELS[video.status] || video.status || '视频任务'}
            </span>
            {!simulated && (
              <button
                className="text-action"
                onClick={queryTask}
                disabled={loading}
              >
                <FiRefreshCw className={loading ? 'spinning' : ''} />{' '}
                {loading ? '查询中' : '查询任务'}
              </button>
            )}
          </div>
          <div className="result-task-id">
            <span>任务 ID</span>
            <code>{videoId}</code>
            <button
              className="btn-icon"
              title="复制任务 ID"
              aria-label="复制任务 ID"
              onClick={copyTaskId}
            >
              <FiCopy />
            </button>
            {copied && <small>已复制</small>}
          </div>
          {!videoSrc && video.status !== 'failed' && (
            <p className="result-task-hint">
              任务已提交，可稍后查询。也可以将任务 ID
              填入视频节点，继续等待结果。
            </p>
          )}
          {videoSrc && (
            <>
              <video src={videoSrc} controls preload="metadata" />
              <a
                className="text-action"
                href={videoSrc}
                target="_blank"
                rel="noreferrer"
              >
                打开视频 <FiExternalLink />
              </a>
            </>
          )}
          {(video.error || error) && (
            <div className="result-inline-error" role="alert">
              {error || video.error}
            </div>
          )}
        </div>
      )}
      {Array.isArray(output.searchResults) &&
        output.searchResults.length > 0 && (
          <details className="result-json">
            <summary>
              搜索参考资料 <FiChevronDown />
            </summary>
            <ul>
              {output.searchResults.map((item, index) =>
                mediaUrl(item.url) ? (
                  <li key={index}>
                    <a
                      href={mediaUrl(item.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.title || item.url} <FiExternalLink />
                    </a>
                  </li>
                ) : null
              )}
            </ul>
          </details>
        )}
      <details className="result-json">
        <summary>
          查看输出数据 <FiChevronDown />
        </summary>
        <pre>{JSON.stringify(output, null, 2)}</pre>
      </details>
    </div>
  );
}

export default function ExecutionResult({ record }) {
  if (!record) return null;
  const results = record.nodeResults || [];
  const StatusIcon =
    record.status === 'failed'
      ? FiAlertCircle
      : record.status === 'running'
        ? FiClock
        : FiCheckCircle;
  return (
    <section className="execution-result" aria-label="工作流执行结果">
      <header className="result-summary">
        <div className={`result-status-icon ${record.status}`}>
          <StatusIcon />
        </div>
        <div>
          <h3>{LABELS[record.status] || record.status || '运行结果'}</h3>
          <p>
            {results.length} 个节点 ·{' '}
            {((record.durationMs || 0) / 1000).toFixed(2)} 秒
            {record.simulated ? ' · 模拟预览' : ' · 模型运行'}
          </p>
        </div>
        <span className={`badge ${record.simulated ? 'simulated' : 'success'}`}>
          {record.simulated ? 'SIMULATION' : 'LIVE RUN'}
        </span>
      </header>
      {(record.error || record.error_msg) && (
        <div className="result-inline-error" role="alert">
          {record.error || record.error_msg}
        </div>
      )}
      {results.length > 0 ? (
        <div className="result-node-list">
          {results.map((node, index) => (
            <details
              className={`result-node ${node.status}`}
              key={node.nodeId || index}
              open={
                ['llm', 'imageGeneration', 'videoGeneration'].includes(
                  node.nodeType
                ) || node.status === 'failed'
              }
            >
              <summary>
                <span className="result-node-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <strong>{node.nodeName || node.nodeId || '节点'}</strong>
                  <small>{node.nodeType}</small>
                </div>
                <span className={`badge ${node.status}`}>
                  {LABELS[node.status] || node.status}
                </span>
                <FiChevronDown className="result-chevron" />
              </summary>
              <div className="result-node-content">
                {node.error && (
                  <div className="result-inline-error">{node.error}</div>
                )}
                <NodeOutput output={node.output} simulated={record.simulated} />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="result-no-nodes">
          {record.status === 'running'
            ? '节点正在执行，运行记录会自动刷新。'
            : '这条历史记录没有逐节点日志。'}
        </div>
      )}
      <details className="result-json result-final">
        <summary>
          工作流最终输出 <FiChevronDown />
        </summary>
        <pre>{JSON.stringify(record.output ?? {}, null, 2)}</pre>
      </details>
    </section>
  );
}
