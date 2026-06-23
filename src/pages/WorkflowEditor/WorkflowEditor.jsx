import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NodePanel from '../../components/NodePanel/NodePanel';
import WorkflowCanvas from '../../components/WorkflowCanvas/WorkflowCanvas';
import ConfigPanel from '../../components/ConfigPanel/ConfigPanel';
import useWorkflowStore from '../../store/workflowStore';
import { workflowDefAPI } from '../../services/api';
import localStorageService from '../../services/localStorage';
import { DEFAULT_NODE_TYPES } from '../../constants/nodeTypes';
import './WorkflowEditor.css';

const getNodeMeta = (type) => DEFAULT_NODE_TYPES.find((item) => item.type === type) || {};

const toCanvasNode = (node, index) => {
  if (node.data) return node;
  const meta = getNodeMeta(node.type);
  return {
    id: node.id || `node-${index}`,
    type: 'custom',
    position: node.position || { x: 180 + index * 220, y: 160 },
    data: {
      label: node.name || meta.name || node.type,
      type: node.type,
      category: node.category || meta.category || 'other',
      icon: node.icon || meta.icon || '',
      hasInput: node.hasInput ?? Boolean(meta.inputs?.length),
      hasOutput: node.hasOutput ?? Boolean(meta.outputs?.length),
      config: node.parameters || node.config || {},
    },
  };
};

const toWorkflowNode = (node) => ({
  id: node.id,
  type: node.data?.type || node.type,
  name: node.data?.label || node.name || node.id,
  position: node.position,
  parameters: node.data?.config || node.parameters || {},
  category: node.data?.category,
  icon: node.data?.icon,
});

const toWorkflowEdge = (edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle,
  targetHandle: edge.targetHandle,
  type: edge.type || 'smoothstep',
});

const WorkflowEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentWorkflow,
    setCurrentWorkflow,
    nodes,
    edges,
    loadWorkflow,
    clearCanvas,
    isNodePanelOpen,
    isConfigPanelOpen,
  } = useWorkflowStore();

  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);

  const fetchWorkflow = useCallback(async (workflowId) => {
    try {
      const response = await workflowDefAPI.getWorkflow(workflowId);
      const workflow = response.data;
      loadWorkflow({
        ...workflow,
        nodes: (workflow.nodes || []).map(toCanvasNode),
        edges: workflow.edges || [],
      });
    } catch (error) {
      const localWorkflow = localStorageService.getWorkflow(workflowId);
      if (localWorkflow) {
        loadWorkflow({
          ...localWorkflow,
          nodes: (localWorkflow.nodes || []).map(toCanvasNode),
          edges: localWorkflow.edges || [],
        });
      } else {
        alert(`加载失败：${error.response?.data?.msg || error.message}`);
      }
    }
  }, [loadWorkflow]);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchWorkflow(id);
    } else {
      clearCanvas();
      setCurrentWorkflow(null);
      setWorkflowName('未命名工作流');
      setDescription('');
      setValidation(null);
    }
  }, [id, clearCanvas, fetchWorkflow, setCurrentWorkflow]);

  useEffect(() => {
    if (currentWorkflow) {
      setWorkflowName(currentWorkflow.name || '未命名工作流');
      setDescription(currentWorkflow.description || '');
      setValidation(currentWorkflow.latestValidation || null);
    }
  }, [currentWorkflow]);

  const buildWorkflowPayload = () => ({
    name: workflowName.trim() || '未命名工作流',
    description,
    tags: currentWorkflow?.tags || [],
    status: currentWorkflow?.status || 'draft',
    nodes: nodes.map(toWorkflowNode),
    edges: edges.map(toWorkflowEdge),
    variables: currentWorkflow?.variables || {},
    settings: currentWorkflow?.settings || { timeoutMs: 60000 },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const workflowData = buildWorkflowPayload();
      let response;
      if (id && id !== 'new') {
        response = await workflowDefAPI.updateWorkflow(id, workflowData);
        setCurrentWorkflow({ ...(currentWorkflow || {}), ...workflowData, id, latestValidation: response.data?.validation });
      } else {
        response = await workflowDefAPI.createWorkflow(workflowData);
        const newId = response.data?.id;
        setCurrentWorkflow({ ...workflowData, id: newId, latestValidation: response.data?.validation });
        navigate(`/workflows/${newId}/edit`, { replace: true });
      }
      setValidation(response.data?.validation || null);
      alert('保存成功');
    } catch (apiError) {
      const workflowData = buildWorkflowPayload();
      if (id && id !== 'new') workflowData.id = id;
      const saved = localStorageService.saveWorkflow(workflowData);
      setCurrentWorkflow(saved);
      if (!id || id === 'new') navigate(`/workflows/${saved.id}/edit`, { replace: true });
      alert(`后端保存失败，已暂存到本地：${apiError.response?.data?.msg || apiError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const workflowId = id && id !== 'new' ? id : undefined;
      const response = await workflowDefAPI.validateWorkflow({
        id: workflowId,
        nodes: nodes.map(toWorkflowNode),
        edges: edges.map(toWorkflowEdge),
      });
      setValidation(response.data);
    } catch (error) {
      alert(`校验失败：${error.response?.data?.msg || error.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!id || id === 'new') {
      alert('请先保存工作流');
      return;
    }
    try {
      await workflowDefAPI.updateWorkflow(id, { status: 'published' });
      setCurrentWorkflow({ ...(currentWorkflow || {}), status: 'published' });
      alert('已发布');
    } catch (error) {
      alert(`发布失败：${error.response?.data?.msg || error.message}`);
    }
  };

  const handleExecute = async () => {
    if (!id || id === 'new') {
      alert('请先保存工作流');
      return;
    }

    setExecuting(true);
    try {
      const response = await workflowDefAPI.executeWorkflow(id, {
        question: '从编辑器手动运行',
      });
      setValidation({ valid: response.code === 200, errors: response.data?.error ? [response.data.error] : [], warnings: [] });
      alert(response.msg || '运行完成');
      navigate(`/executions/${response.data.id}`);
    } catch (error) {
      alert(`执行失败：${error.response?.data?.msg || error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleBack = () => {
    if (window.confirm('确定离开吗？未保存的更改将丢失。')) {
      navigate('/workflows');
    }
  };

  return (
    <div className="workflow-editor">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button onClick={handleBack} className="btn-icon" title="返回">
            ←
          </button>
          <div className="workflow-name-input">
            <input
              type="text"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              placeholder="输入工作流名称"
            />
          </div>
          <input
            className="workflow-description-input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="工作流说明"
          />
          <span className="workflow-status">
            {currentWorkflow?.status === 'published' ? '已发布' : '草稿'}
          </span>
          {validation && (
            <span className={`validation-chip ${validation.valid ? 'valid' : 'invalid'}`}>
              {validation.valid ? '校验通过' : `问题 ${validation.errors?.length || 0}`}
            </span>
          )}
        </div>

        <div className="toolbar-right">
          <button onClick={handleValidate} disabled={validating} className="btn btn-default">
            {validating ? '校验中...' : '校验'}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={handlePublish} disabled={!id || id === 'new'} className="btn btn-default">
            发布
          </button>
          <button onClick={handleExecute} disabled={executing || !id || id === 'new'} className="btn btn-success">
            {executing ? '运行中...' : '运行'}
          </button>
        </div>
      </div>

      {validation && !validation.valid && (
        <div className="validation-bar">
          {(validation.errors || []).map((error) => <span key={error}>{error}</span>)}
          {(validation.warnings || []).map((warning) => <span key={warning}>{warning}</span>)}
        </div>
      )}

      <div className="editor-main">
        {isNodePanelOpen && <NodePanel />}
        <div className="editor-canvas">
          <WorkflowCanvas />
        </div>
        {isConfigPanelOpen && <ConfigPanel />}
      </div>
    </div>
  );
};

export default WorkflowEditor;
