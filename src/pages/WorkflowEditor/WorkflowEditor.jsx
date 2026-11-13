import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiSidebar,
  FiRotateCcw,
  FiRotateCw,
  FiSave,
  FiPlay,
  FiCheckCircle,
  FiChevronDown,
  FiExternalLink,
  FiSliders,
  FiSquare,
  FiCloud,
  FiHardDrive,
  FiMessageSquare,
} from 'react-icons/fi';
import NodePanel from '../../components/NodePanel/NodePanel';
import WorkflowCanvas from '../../components/WorkflowCanvas/WorkflowCanvas';
import ConfigPanel from '../../components/ConfigPanel/ConfigPanel';
import ExecutionResult from '../../components/ExecutionResult/ExecutionResult';
import WorkflowAssistant from '../../components/WorkflowAssistant/WorkflowAssistant';
import useWorkflowStore from '../../store/workflowStore';
import { aiWorkflowAPI, workflowDefAPI } from '../../services/api';
import localStorageService from '../../services/localStorage';
import {
  DEFAULT_NODE_TYPES,
  getDefaultParameters,
} from '../../constants/nodeTypes';
import { WORKFLOW_TEMPLATES } from '../../constants/workflowTemplates';
import './WorkflowEditor.css';

const toCanvasNode = (node, index) => {
  const type = node.data?.type || node.type;
  const meta = DEFAULT_NODE_TYPES.find((item) => item.type === type) || {};
  return {
    id: String(node.id || `node-${index}`),
    type: 'custom',
    position: node.position || { x: 120 + index * 290, y: 180 },
    data: {
      ...node.data,
      label: node.data?.label || node.name || meta.name || type,
      type,
      category:
        node.data?.category || node.category || meta.category || 'other',
      icon: node.data?.icon || node.icon || meta.icon,
      hasInput: node.data?.hasInput ?? Boolean(meta.inputs?.length),
      hasOutput: node.data?.hasOutput ?? Boolean(meta.outputs?.length),
      previewOnly: meta.previewOnly || meta.executable === false,
      config: {
        ...getDefaultParameters(meta),
        ...(node.data?.config || node.parameters || node.config || {}),
      },
    },
  };
};

const toWorkflowNode = (node) => ({
  id: node.id,
  type: node.data?.type || node.type,
  name: node.data?.label || node.name || node.id,
  position: node.position,
  parameters: node.data?.config || node.parameters || {},
});
const toWorkflowEdge = (edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle,
  targetHandle: edge.targetHandle,
  type: edge.type || 'smoothstep',
});
const metaFingerprint = (name, description, variables, timeout) =>
  JSON.stringify([name, description, variables, String(timeout)]);
const errorText = (error) =>
  error.execution?.error ||
  error.data?.error ||
  error.response?.data?.msg ||
  error.message ||
  '操作失败，请稍后重试';
const parseObject = (value, label) => {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label}需要有效的 JSON`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`${label}需要为 JSON 对象`);
  return parsed;
};

const WorkflowEditor = () => {
  const { id = 'new' } = useParams();
  const location = useLocation();
  const { search } = location;
  const initialPrompt =
    id === 'new' && typeof location.state?.initialPrompt === 'string'
      ? location.state.initialPrompt
      : '';
  const navigate = useNavigate();
  const {
    currentWorkflow,
    setCurrentWorkflow,
    loadWorkflow,
    nodes,
    isDirty,
    markSaved,
    workflowSource,
    isNodePanelOpen,
    isConfigPanelOpen,
    selectNode,
    toggleNodePanel,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWorkflowStore();
  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [description, setDescription] = useState('');
  const [variablesText, setVariablesText] = useState('{}');
  const [inputText, setInputText] = useState('{}');
  const [timeoutValue, setTimeoutValue] = useState('180000');
  const [metadataBaseline, setMetadataBaseline] = useState(
    metaFingerprint('未命名工作流', '', '{}', 180000)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [notice, setNotice] = useState(null);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [simulate, setSimulate] = useState(false);
  const [executionRecord, setExecutionRecord] = useState(null);
  const [resultOpen, setResultOpen] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(Boolean(initialPrompt));
  const [conversationKey, setConversationKey] = useState(0);
  const canvasRef = useRef(null);
  const loadedKeyRef = useRef(null);
  const requestRef = useRef(null);
  const documentSequenceRef = useRef(0);
  const generatedChangesRef = useRef(new Map());
  const fitTimerRef = useRef(null);
  const busy = loading || saving || publishing || executing;
  const metadataDirty =
    metadataBaseline !==
    metaFingerprint(workflowName, description, variablesText, timeoutValue);
  const dirty = isDirty || metadataDirty;

  const applyDocument = useCallback(
    (workflow, source) => {
      const name = workflow.name || '未命名工作流';
      const details = workflow.description || '';
      const variables = JSON.stringify(workflow.variables || {}, null, 2);
      const timeout = String(workflow.settings?.timeoutMs || 180000);
      loadWorkflow(
        {
          ...workflow,
          nodes: (workflow.nodes || []).map(toCanvasNode),
          edges: (workflow.edges || []).map((edge, index) => ({
            ...edge,
            id: edge.id || `edge-${index}`,
            source: edge.source || edge.from,
            target: edge.target || edge.to,
          })),
        },
        { source }
      );
      setWorkflowName(name);
      setDescription(details);
      setVariablesText(variables);
      setTimeoutValue(timeout);
      setMetadataBaseline(metaFingerprint(name, details, variables, timeout));
      setInputText(JSON.stringify(workflow.input || {}, null, 2));
      setValidation(workflow.latestValidation || null);
      setExecutionRecord(null);
      generatedChangesRef.current.clear();
      setConversationKey(++documentSequenceRef.current);
    },
    [loadWorkflow]
  );

  useEffect(() => {
    const query = new URLSearchParams(search);
    const local = query.get('local') === 'true';
    const starter = query.get('starter') || '';
    const key = `${id}:${local ? 'local' : 'server'}:${starter}`;
    if (loadedKeyRef.current === key) {
      loadedKeyRef.current = null;
      setLoading(false);
      return;
    }
    loadedKeyRef.current = null;
    let active = true;
    setAssistantOpen(Boolean(initialPrompt));
    setNotice(null);
    setLoading(true);
    const load = async () => {
      if (id === 'new') {
        const template = WORKFLOW_TEMPLATES.find((item) => item.id === starter);
        applyDocument(
          {
            ...(template || {}),
            id: null,
            nodes: template?.nodes || [],
            edges: template?.edges || [],
            settings: { timeoutMs: 180000 },
          },
          'new'
        );
        return;
      }
      const draft = localStorageService.getWorkflow(id);
      if (local) {
        if (!draft) throw new Error('本地草稿不存在，可能已被清理');
        applyDocument(draft, 'local');
        return;
      }
      try {
        const response = await workflowDefAPI.getWorkflow(id);
        if (active) applyDocument(response.data, 'server');
      } catch (error) {
        if (!active) return;
        if (!draft) throw error;
        applyDocument(draft, 'local');
        setNotice({
          type: 'warning',
          text: `服务器加载失败，已打开本地草稿。${errorText(error)}`,
        });
      }
    };
    load()
      .catch((error) => {
        if (active) {
          applyDocument({ nodes: [], edges: [] }, 'new');
          setNotice({ type: 'error', text: errorText(error) });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, search, initialPrompt, applyDocument]);

  useEffect(() => {
    if (
      window.matchMedia('(max-width: 760px)').matches &&
      useWorkflowStore.getState().isNodePanelOpen
    )
      useWorkflowStore.getState().toggleNodePanel();
    return () => {
      requestRef.current?.abort();
      clearTimeout(fitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isConfigPanelOpen) setAssistantOpen(false);
    if (isConfigPanelOpen && window.matchMedia('(max-width: 760px)').matches) {
      setParametersOpen(false);
      setResultOpen(false);
    }
  }, [isConfigPanelOpen]);

  const buildPayload = () => {
    const timeoutMs = Number(timeoutValue);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000)
      throw new Error('运行超时需要为 1000 至 600000 毫秒');
    const graph = useWorkflowStore.getState();
    return {
      name: workflowName.trim() || '未命名工作流',
      description,
      tags: currentWorkflow?.tags || [],
      status: currentWorkflow?.status || 'draft',
      nodes: graph.nodes.map(toWorkflowNode),
      edges: graph.edges.map(toWorkflowEdge),
      variables: parseObject(variablesText, '工作流变量'),
      settings: { ...currentWorkflow?.settings, timeoutMs },
    };
  };

  const metadataSnapshot = () => ({
    name: workflowName,
    description,
    variables: variablesText,
    input: inputText,
    timeout: timeoutValue,
  });
  const restoreMetadata = (metadata) => {
    setWorkflowName(metadata.name);
    setDescription(metadata.description);
    setVariablesText(metadata.variables);
    setInputText(metadata.input);
    setTimeoutValue(metadata.timeout);
  };
  const handleUndo = () => {
    const graph = useWorkflowStore.getState();
    const generated = generatedChangesRef.current.get(
      graph.history[graph.historyIndex]
    );
    undo();
    if (generated) restoreMetadata(generated.before);
    setValidation(null);
  };
  const handleRedo = () => {
    const graph = useWorkflowStore.getState();
    const generated = generatedChangesRef.current.get(
      graph.history[graph.historyIndex + 1]
    );
    redo();
    if (generated) restoreMetadata(generated.after);
    setValidation(null);
  };
  const applyGeneratedWorkflow = (result) => {
    const draft = result.workflow;
    const graph = useWorkflowStore.getState();
    const previousEntry = graph.history[graph.historyIndex];
    const before = metadataSnapshot();
    const after = {
      name: draft.name,
      description: draft.description || '',
      variables: JSON.stringify(draft.variables || {}, null, 2),
      input: JSON.stringify(result.input || {}, null, 2),
      timeout: String(draft.settings?.timeoutMs || 180000),
    };
    graph.replaceGraph(
      {
        nodes: draft.nodes.map(toCanvasNode),
        edges: draft.edges.map((edge, index) => ({
          ...edge,
          id: edge.id || `edge-${index}`,
          type: edge.type || 'smoothstep',
        })),
      },
      { clearSelection: true, forceHistory: true }
    );
    const updated = useWorkflowStore.getState();
    const currentEntry = updated.history[updated.historyIndex];
    if (currentEntry !== previousEntry)
      generatedChangesRef.current.set(currentEntry, { before, after });
    for (const entry of generatedChangesRef.current.keys()) {
      if (!updated.history.includes(entry))
        generatedChangesRef.current.delete(entry);
    }
    restoreMetadata(after);
    setValidation(null);
    setExecutionRecord(null);
    setParametersOpen(false);
    setNotice({ type: 'success', text: '已生成工作流，可编辑节点后保存。' });
    clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => canvasRef.current?.fitView(), 100);
  };
  const getAssistantRevision = () => {
    const graph = useWorkflowStore.getState();
    return JSON.stringify({
      ...metadataSnapshot(),
      nodes: graph.nodes.map(toWorkflowNode),
      edges: graph.edges.map(toWorkflowEdge),
      documentId: graph.currentWorkflow?.id || graph.currentWorkflow?._id,
      selectedNode: graph.selectedNode?.id,
      configuring: graph.isConfigPanelOpen,
    });
  };
  const handleToggleAssistant = () => {
    if (assistantOpen) {
      setAssistantOpen(false);
      return;
    }
    selectNode(null);
    setAssistantOpen(true);
    setParametersOpen(false);
    setResultOpen(false);
    if (
      window.matchMedia('(max-width: 760px)').matches &&
      useWorkflowStore.getState().isNodePanelOpen
    )
      toggleNodePanel();
  };
  const handleToggleNodePanel = () => {
    if (window.matchMedia('(max-width: 760px)').matches) {
      setAssistantOpen(false);
      selectNode(null);
    }
    toggleNodePanel();
  };

  const persistWorkflow = async () => {
    const payload = buildPayload();
    setSaving(true);
    try {
      const serverId =
        workflowSource === 'server'
          ? currentWorkflow?.id || currentWorkflow?._id
          : null;
      const response = serverId
        ? await workflowDefAPI.updateWorkflow(serverId, payload)
        : await workflowDefAPI.createWorkflow(payload);
      const savedId = serverId || response.data?.id || response.data?._id;
      if (!savedId) throw new Error('服务器未返回工作流 ID，保存尚未完成');
      const saved = {
        ...payload,
        id: savedId,
        _id: savedId,
        latestValidation: response.data?.validation,
      };
      setCurrentWorkflow(saved, { source: 'server' });
      markSaved();
      setWorkflowName(payload.name);
      setVariablesText(JSON.stringify(payload.variables, null, 2));
      setMetadataBaseline(
        metaFingerprint(
          payload.name,
          payload.description,
          JSON.stringify(payload.variables, null, 2),
          payload.settings.timeoutMs
        )
      );
      setValidation(response.data?.validation || null);
      // 新建后的地址只更新路由，不重新加载并覆盖正在运行的当前画布。
      if (id !== savedId || search) {
        loadedKeyRef.current = `${savedId}:server:`;
        navigate(`/workflows/${savedId}/edit`, { replace: true });
      }
      return { id: savedId, payload };
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      await persistWorkflow();
      setNotice({ type: 'success', text: '当前工作流已保存到服务器。' });
    } catch (error) {
      setNotice({
        type: 'error',
        text: `服务器保存失败。${errorText(error)}，可使用“存为本地草稿”保留编辑。`,
      });
    }
  };

  const handleLocalSave = () => {
    try {
      const payload = buildPayload();
      const saved = localStorageService.saveWorkflow({
        ...payload,
        id:
          currentWorkflow?.id ||
          currentWorkflow?._id ||
          (id !== 'new' ? id : undefined),
        _source: 'local',
        isLocal: true,
      });
      setCurrentWorkflow(saved, { source: 'local' });
      markSaved();
      setWorkflowName(payload.name);
      setVariablesText(JSON.stringify(payload.variables, null, 2));
      setMetadataBaseline(
        metaFingerprint(
          payload.name,
          payload.description,
          JSON.stringify(payload.variables, null, 2),
          payload.settings.timeoutMs
        )
      );
      if (id !== saved.id || search !== '?local=true') {
        loadedKeyRef.current = `${saved.id}:local:`;
        navigate(`/workflows/${saved.id}/edit?local=true`, { replace: true });
      }
      setNotice({
        type: 'success',
        text: '已保存在当前浏览器。同步到服务器时将创建独立工作流。',
      });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error) });
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const payload = buildPayload();
      const response = await workflowDefAPI.validateWorkflow({
        nodes: payload.nodes,
        edges: payload.edges,
      });
      setValidation(response.data);
      setNotice({
        type: response.data.valid ? 'success' : 'warning',
        text: response.data.valid
          ? '节点与连接校验通过。'
          : '请根据校验提示调整当前工作流。',
      });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error) });
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const saved = await persistWorkflow();
      await workflowDefAPI.updateWorkflow(saved.id, { status: 'published' });
      setCurrentWorkflow(
        { ...useWorkflowStore.getState().currentWorkflow, status: 'published' },
        { source: 'server' }
      );
      setNotice({ type: 'success', text: '工作流已发布。' });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error) });
    } finally {
      setPublishing(false);
    }
  };

  const handleExecute = async () => {
    let input;
    try {
      input = parseObject(inputText, '运行输入');
      buildPayload();
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error) });
      setParametersOpen(true);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setParametersOpen(false);
    setAssistantOpen(false);
    selectNode(null);
    setExecuting(true);
    setResultOpen(true);
    setNotice({ type: 'info', text: '正在保存当前画布，然后开始执行…' });
    setExecutionRecord({
      status: 'running',
      simulated: simulate,
      workflowName,
      input,
      nodeResults: [],
    });
    try {
      const saved = await persistWorkflow();
      if (controller.signal.aborted)
        throw new DOMException('请求已停止', 'AbortError');
      setNotice({
        type: 'info',
        text: simulate
          ? '正在模拟预览工作流。'
          : '正在执行 Flash 模型节点，视频生成可能需要一些时间。',
      });
      const response = await aiWorkflowAPI.run(saved.id, input, {
        simulate,
        signal: controller.signal,
        timeoutMs: saved.payload.settings.timeoutMs,
      });
      setExecutionRecord({
        ...response.data,
        id: response.data.id || response.data.executionId,
        workflowName: saved.payload.name,
        input,
      });
      setNotice({
        type: 'success',
        text: simulate ? '模拟预览已完成。' : '工作流执行完成。',
      });
    } catch (error) {
      const record =
        error.execution || (error.data?.executionId ? error.data : null);
      const cancelled =
        controller.signal.aborted || error.code === 'ERR_CANCELED';
      const message = cancelled
        ? '请求已停止。已提交的视频任务可到执行记录中查看。'
        : errorText(error);
      setExecutionRecord(
        record
          ? {
              ...record,
              id: record.id || record.executionId,
              workflowName,
              input,
            }
          : {
              status: 'failed',
              simulated: simulate,
              workflowName,
              input,
              error: message,
              nodeResults: [],
            }
      );
      setNotice({ type: cancelled ? 'warning' : 'error', text: message });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setExecuting(false);
    }
  };

  const handleAddNode = (meta) => {
    canvasRef.current?.addNodeAtCenter(meta);
    if (
      window.matchMedia('(max-width: 760px)').matches &&
      useWorkflowStore.getState().isNodePanelOpen
    )
      toggleNodePanel();
  };
  const handleBack = () => {
    if (!dirty || window.confirm('当前编辑尚未保存，确定离开吗？'))
      navigate('/workflows');
  };
  const handleToggleParameters = () => {
    if (parametersOpen) {
      setParametersOpen(false);
      return;
    }
    setParametersOpen(true);
    setResultOpen(false);
    if (window.matchMedia('(max-width: 760px)').matches) {
      selectNode(null);
      setAssistantOpen(false);
    }
  };
  const handleToggleResult = () => {
    if (resultOpen) {
      setResultOpen(false);
      return;
    }
    setResultOpen(true);
    setParametersOpen(false);
    if (window.matchMedia('(max-width: 760px)').matches) {
      selectNode(null);
      setAssistantOpen(false);
    }
  };
  const handleKeyDown = (event) => {
    if (
      !(event.ctrlKey || event.metaKey) ||
      event.target.closest?.(
        'input, textarea, select, [contenteditable="true"]'
      )
    )
      return;
    if (event.key.toLowerCase() === 'z' && !busy) {
      event.preventDefault();
      if (event.shiftKey) handleRedo();
      else handleUndo();
    }
    if (event.key.toLowerCase() === 'y' && !busy) {
      event.preventDefault();
      handleRedo();
    }
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!busy) handleSave();
    }
  };
  const executionId =
    executionRecord?.id || executionRecord?.executionId || executionRecord?._id;

  return (
    <div className="workflow-editor" onKeyDown={handleKeyDown}>
      <header className="editor-toolbar">
        <div className="editor-title-group">
          <button
            onClick={handleBack}
            className="editor-icon-button"
            title="返回工作流"
            aria-label="返回工作流"
            disabled={busy}
          >
            <FiArrowLeft />
          </button>
          <div className="editor-document">
            <div className="editor-document-top">
              <input
                aria-label="工作流名称"
                value={workflowName}
                onChange={(event) => setWorkflowName(event.target.value)}
                disabled={busy}
              />
              <span className={`editor-source source-${workflowSource}`}>
                {workflowSource === 'local' ? <FiHardDrive /> : <FiCloud />}
                {workflowSource === 'local'
                  ? '本地草稿'
                  : workflowSource === 'server'
                    ? '服务器'
                    : '新建'}
              </span>
            </div>
            <span className="editor-document-state">
              <i className={dirty ? 'is-dirty' : ''} />
              {dirty
                ? '有未保存的修改'
                : workflowSource === 'new'
                  ? '准备开始编排'
                  : '当前版本已保存'}
              <span>·</span>
              {currentWorkflow?.status === 'published' ? '已发布' : '草稿'}
            </span>
          </div>
        </div>
        <div className="editor-toolbar-actions">
          <button
            className="btn btn-default editor-secondary-action"
            aria-label="存为本地草稿"
            title="存为本地草稿"
            disabled={busy}
            onClick={handleLocalSave}
          >
            <FiHardDrive />
            <span>存为本地草稿</span>
          </button>
          <button
            className="btn btn-default"
            disabled={busy || validating}
            onClick={handleValidate}
          >
            <FiCheckCircle />
            {validating ? '校验中' : '校验'}
          </button>
          <button
            className="btn btn-default"
            disabled={busy}
            onClick={handleSave}
          >
            <FiSave />
            {saving
              ? '保存中'
              : workflowSource === 'local'
                ? '保存到服务器'
                : '保存'}
          </button>
          <button
            className="btn btn-default editor-publish-action"
            disabled={busy || !nodes.length}
            onClick={handlePublish}
          >
            发布
          </button>
          {executing ? (
            <button
              className="btn btn-default editor-stop-button"
              onClick={() => requestRef.current?.abort()}
            >
              <FiSquare />
              停止请求
            </button>
          ) : (
            <button
              className="btn btn-primary editor-run-button"
              disabled={busy || !nodes.length}
              onClick={handleExecute}
            >
              <FiPlay />
              运行工作流
            </button>
          )}
        </div>
      </header>
      <div className="editor-subtoolbar">
        <div className="editor-tools">
          <button
            className={`editor-tool ${isNodePanelOpen ? 'is-active' : ''}`}
            onClick={handleToggleNodePanel}
            aria-label="切换节点库"
            title="节点库"
          >
            <FiSidebar />
          </button>
          <span className="editor-tool-divider" />
          <button
            className="editor-tool"
            disabled={busy || !canUndo}
            onClick={handleUndo}
            aria-label="撤销"
            title="撤销 Ctrl+Z"
          >
            <FiRotateCcw />
          </button>
          <button
            className="editor-tool"
            disabled={busy || !canRedo}
            onClick={handleRedo}
            aria-label="重做"
            title="重做 Ctrl+Shift+Z"
          >
            <FiRotateCw />
          </button>
          <button
            className={`editor-assistant-toggle ${assistantOpen ? 'is-active' : ''}`}
            aria-expanded={assistantOpen}
            onClick={handleToggleAssistant}
            disabled={loading}
          >
            <FiMessageSquare />
            对话生成
          </button>
        </div>
        <div className="editor-run-settings">
          <select
            aria-label="执行模式"
            value={simulate ? 'simulated' : 'real'}
            onChange={(event) =>
              setSimulate(event.target.value === 'simulated')
            }
            disabled={busy}
          >
            <option value="real">真实执行 · Flash</option>
            <option value="simulated">模拟预览</option>
          </select>
          <button
            className={`editor-parameter-toggle ${parametersOpen ? 'is-active' : ''}`}
            aria-expanded={parametersOpen}
            onClick={handleToggleParameters}
          >
            <FiSliders />
            运行参数
            <FiChevronDown />
          </button>
        </div>
      </div>
      {parametersOpen && (
        <section className="editor-parameters" aria-label="运行参数">
          <label className="editor-description-field">
            工作流说明
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={busy}
              placeholder="描述这条工作流解决的问题"
            />
          </label>
          <div className="editor-json-fields">
            <label>
              运行输入 <span>input</span>
              <textarea
                aria-label="运行输入 JSON"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                disabled={busy}
                spellCheck={false}
              />
            </label>
            <label>
              工作流变量 <span>variables</span>
              <textarea
                aria-label="工作流变量 JSON"
                value={variablesText}
                onChange={(event) => setVariablesText(event.target.value)}
                disabled={busy}
                spellCheck={false}
              />
            </label>
            <div className="editor-timeout-field">
              <label>
                运行超时 <span>毫秒</span>
                <input
                  type="number"
                  min="1000"
                  max="600000"
                  step="1000"
                  aria-label="运行超时毫秒"
                  value={timeoutValue}
                  onChange={(event) => setTimeoutValue(event.target.value)}
                  disabled={busy}
                />
              </label>
              <p>真实执行支持触发器、Flash 文本 / 图片 / 视频及输出节点。</p>
            </div>
          </div>
        </section>
      )}
      {notice && (
        <div
          className={`editor-notice notice-${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
          <button aria-label="关闭提示" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {validation && !validation.valid && (
        <div className="editor-validation">
          {(validation.errors || []).map((message) => (
            <span key={message}>{message}</span>
          ))}
        </div>
      )}
      <div className={`editor-main ${busy ? 'is-busy' : ''}`}>
        {isNodePanelOpen && (
          <NodePanel onAddNode={handleAddNode} disabled={busy} />
        )}
        <div className="editor-canvas">
          <WorkflowCanvas ref={canvasRef} disabled={busy} />
          {loading && <div className="editor-loading">正在加载工作流…</div>}
        </div>
        {isConfigPanelOpen && <ConfigPanel />}
        <WorkflowAssistant
          key={conversationKey}
          open={assistantOpen}
          ready={!loading}
          disabled={busy}
          initialPrompt={initialPrompt}
          initialRequestKey={location.state?.requestKey || location.key}
          getWorkflow={() => ({
            ...buildPayload(),
            input: parseObject(inputText, '运行输入'),
          })}
          getRevision={getAssistantRevision}
          onApply={applyGeneratedWorkflow}
          onClose={() => setAssistantOpen(false)}
        />
      </div>
      {executionRecord && (
        <section className={`editor-execution ${resultOpen ? 'is-open' : ''}`}>
          <div className="editor-execution-header">
            <button aria-expanded={resultOpen} onClick={handleToggleResult}>
              <FiChevronDown />
              <span>执行结果</span>
              <small className={`execution-status-${executionRecord.status}`}>
                {executionRecord.status === 'running'
                  ? '运行中'
                  : executionRecord.status === 'success'
                    ? '已完成'
                    : '执行失败'}
              </small>
              {executionRecord.simulated && <small>模拟预览</small>}
            </button>
            {executionId && (
              <Link to={`/executions/${executionId}`}>
                查看完整记录
                <FiExternalLink />
              </Link>
            )}
          </div>
          {resultOpen && (
            <div className="editor-execution-body">
              <ExecutionResult record={executionRecord} />
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default WorkflowEditor;
