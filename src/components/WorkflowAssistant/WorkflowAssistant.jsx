import React, { useEffect, useRef, useState } from 'react';
import {
  FiArrowUp,
  FiCheck,
  FiGitBranch,
  FiGlobe,
  FiMessageSquare,
  FiRefreshCw,
  FiSquare,
  FiX,
} from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import { aiWorkflowAPI } from '../../services/api';
import { FLASH_MODEL_CATALOG } from '../../constants/nodeTypes';
import './WorkflowAssistant.css';

const EXAMPLES = [
  '把产品主题整理成文案，再生成配图',
  '根据我的视频描述，创建一个短片生成工作流',
];

function generationError(error) {
  if (error.code === 400 || error.response?.status === 401)
    return '请先登录后生成工作流。';
  const message = error.response?.data?.msg || error.message || '';
  if (
    !message ||
    /https?:\/\/|\bat\s+\S+\s*\(|API_KEY|BASE_URL|Mongo|ECONN|Network Error|timeout/i.test(
      message
    )
  )
    return '生成暂时失败，请稍后重试。';
  return message;
}

export default function WorkflowAssistant({
  open,
  disabled = false,
  ready = true,
  initialPrompt = '',
  initialRequestKey = '',
  getWorkflow,
  getRevision,
  onApply,
  onClose,
}) {
  const location = useLocation();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(FLASH_MODEL_CATALOG.text[0]);
  const [models, setModels] = useState(FLASH_MODEL_CATALOG.text);
  const [search, setSearch] = useState(false);
  const [messages, setMessages] = useState([]);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [candidate, setCandidate] = useState(null);
  const [feedback, setFeedback] = useState('');
  const historyRef = useRef([]);
  const activeRequestRef = useRef(null);
  const lastPromptRef = useRef('');
  const initialSentRef = useRef(null);
  const resumeKeyRef = useRef(`resume-${Date.now()}`);
  const transcriptRef = useRef(null);
  const sendRef = useRef(null);
  const propsRef = useRef({ getWorkflow, getRevision, onApply, disabled });
  propsRef.current = { getWorkflow, getRevision, onApply, disabled };

  useEffect(() => {
    let active = true;
    aiWorkflowAPI
      .getModels()
      .then((response) => {
        if (!active) return;
        const options = response.data?.text?.filter((value) =>
          FLASH_MODEL_CATALOG.text.includes(value)
        );
        if (!options?.length) return;
        setModels(options);
        setModel((current) =>
          options.includes(current) ? current : options[0]
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const activeRequest = activeRequestRef;
    return () => {
      const controller = activeRequest.current;
      activeRequest.current = null;
      controller?.abort();
    };
  }, []);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, waiting, error, candidate]);

  const send = async (value, retry = false) => {
    const message = value.trim();
    if (
      !message ||
      activeRequestRef.current ||
      propsRef.current.disabled ||
      !ready
    )
      return;
    let workflow;
    let revision;
    try {
      workflow = propsRef.current.getWorkflow();
      revision = propsRef.current.getRevision();
    } catch (cause) {
      setError(generationError(cause));
      return;
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;
    lastPromptRef.current = message;
    setWaiting(true);
    setError('');
    setFeedback('');
    setRequiresLogin(false);
    setCandidate(null);
    if (!retry)
      setMessages((current) => [
        ...current,
        { role: 'user', content: message },
      ]);
    setPrompt('');
    try {
      const response = await aiWorkflowAPI.generateWorkflow(
        {
          message,
          messages: historyRef.current,
          workflow,
          model,
          search,
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted || activeRequestRef.current !== controller)
        return;
      const result = response.data;
      if (!result || typeof result.reply !== 'string')
        throw new Error('生成结果格式有误，请重试。');
      if (
        result.workflow &&
        (!Array.isArray(result.workflow.nodes) ||
          !result.workflow.nodes.length ||
          !Array.isArray(result.workflow.edges))
      )
        throw new Error('生成的工作流格式有误，请重试。');
      const warnings = Array.isArray(result.warnings)
        ? result.warnings.filter((item) => typeof item === 'string')
        : [];
      if (result.workflow) {
        const changed = propsRef.current.getRevision() !== revision;
        if (propsRef.current.disabled || changed) {
          setCandidate({ result, changed });
        } else {
          propsRef.current.onApply(result);
          setFeedback('已更新画布，可以继续编辑并保存。');
        }
      }
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: message },
        { role: 'assistant', content: result.reply },
      ].slice(-20);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: result.reply, warnings },
      ]);
    } catch (cause) {
      if (activeRequestRef.current !== controller) return;
      if (controller.signal.aborted || cause.code === 'ERR_CANCELED') {
        setFeedback('已停止本次生成。');
      } else {
        setError(generationError(cause));
        setRequiresLogin(cause.code === 400 || cause.response?.status === 401);
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setWaiting(false);
      }
    }
  };
  sendRef.current = send;

  useEffect(() => {
    if (
      !ready ||
      !initialPrompt ||
      initialSentRef.current === initialRequestKey
    )
      return undefined;
    // 延迟到挂载稳定后发送，避免 StrictMode 的首次 effect 重放产生重复请求。
    const timer = setTimeout(() => {
      initialSentRef.current = initialRequestKey;
      sendRef.current(initialPrompt);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialPrompt, initialRequestKey, ready]);

  const applyCandidate = () => {
    if (!candidate || disabled) return;
    try {
      onApply(candidate.result);
      setCandidate(null);
      setFeedback('已将生成结果应用到画布，可以继续编辑并保存。');
    } catch (cause) {
      setError(generationError(cause));
    }
  };

  const submit = (event) => {
    event.preventDefault();
    send(prompt);
  };

  return (
    <aside
      className="workflow-assistant"
      hidden={!open}
      aria-label="工作流对话助手"
    >
      <header className="assistant-header">
        <div>
          <FiMessageSquare />
          <h2>对话生成工作流</h2>
        </div>
        <button
          className="btn-icon"
          aria-label="关闭对话助手"
          onClick={onClose}
        >
          <FiX />
        </button>
      </header>
      <div
        className="assistant-transcript"
        ref={transcriptRef}
        role="log"
        aria-label="工作流生成对话"
      >
        {!messages.length && (
          <div className="assistant-intro">
            <span className="assistant-intro-icon">
              <FiGitBranch />
            </span>
            <h3>描述你想完成的任务</h3>
            <p>我会生成节点和连接，你可以在画布继续编辑并保存。</p>
            <div className="assistant-examples">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  disabled={waiting || disabled || !ready}
                  onClick={() => send(example)}
                >
                  {example}
                  <FiArrowUp />
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            className={`assistant-message message-${message.role}`}
            key={index}
          >
            <span>{message.role === 'user' ? '你' : '工作流助手'}</span>
            <div>{message.content}</div>
            {message.warnings?.map((warning, warningIndex) => (
              <p className="assistant-warning" key={warningIndex}>
                {warning}
              </p>
            ))}
          </div>
        ))}
        {waiting && (
          <div className="assistant-waiting" role="status">
            <FiRefreshCw className="spinning" />
            正在生成工作流…
          </div>
        )}
        {candidate && (
          <div className="assistant-candidate" role="status">
            <p>
              {candidate.changed
                ? '生成期间画布发生了修改，结果已保留。'
                : '生成结果已保留，当前操作完成后可以应用。'}
            </p>
            <button
              className="btn btn-primary"
              disabled={disabled}
              onClick={applyCandidate}
            >
              应用生成结果
            </button>
            <button className="text-action" onClick={() => setCandidate(null)}>
              保留当前画布
            </button>
          </div>
        )}
        {feedback && (
          <div className="assistant-feedback" role="status">
            <FiCheck />
            {feedback}
          </div>
        )}
        {error && (
          <div className="assistant-error" role="alert">
            <p>{error}</p>
            {requiresLogin ? (
              <Link
                to="/login"
                state={{
                  from: location.pathname + location.search,
                  returnState: {
                    ...location.state,
                    initialPrompt: lastPromptRef.current,
                    requestKey: resumeKeyRef.current,
                  },
                }}
                className="text-action"
              >
                去登录
              </Link>
            ) : (
              lastPromptRef.current && (
                <button
                  className="text-action"
                  disabled={waiting || disabled}
                  onClick={() => send(lastPromptRef.current, true)}
                >
                  <FiRefreshCw />
                  重新生成
                </button>
              )
            )}
          </div>
        )}
      </div>
      <form className="assistant-composer" onSubmit={submit}>
        <label
          className="assistant-prompt-label"
          htmlFor="workflow-assistant-prompt"
        >
          {messages.length ? '继续描述修改要求' : '工作流需求'}
        </label>
        <textarea
          id="workflow-assistant-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            messages.length
              ? '例如，把图片节点改为生成横版封面…'
              : '例如，输入产品主题，生成文案、配图和一段视频…'
          }
          rows={4}
          maxLength={6000}
          disabled={waiting || disabled || !ready}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send(prompt);
            }
          }}
        />
        <div className="assistant-options">
          <label>
            <span>Flash 模型</span>
            <select
              aria-label="生成工作流的 Flash 模型"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={waiting || disabled}
            >
              {models.map((value) => (
                <option key={value} value={value}>
                  {value === 'agnes-3.0-flash'
                    ? 'Agnes 3.0 Flash'
                    : 'Agnes 2.5 Flash'}
                </option>
              ))}
            </select>
          </label>
          <label className="assistant-search">
            <input
              type="checkbox"
              checked={search}
              onChange={(event) => setSearch(event.target.checked)}
              disabled={waiting || disabled}
            />
            <FiGlobe />
            联网搜索
          </label>
        </div>
        <div className="assistant-send-row">
          <span>Enter 发送 · Shift + Enter 换行</span>
          {waiting ? (
            <button
              className="btn btn-default"
              type="button"
              onClick={() => activeRequestRef.current?.abort()}
            >
              <FiSquare />
              停止生成
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!prompt.trim() || disabled || !ready}
            >
              <FiArrowUp />
              生成工作流
            </button>
          )}
        </div>
      </form>
    </aside>
  );
}
