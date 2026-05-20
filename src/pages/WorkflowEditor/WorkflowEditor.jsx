import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NodePanel from '../../components/NodePanel/NodePanel';
import WorkflowCanvas from '../../components/WorkflowCanvas/WorkflowCanvas';
import ConfigPanel from '../../components/ConfigPanel/ConfigPanel';
import useWorkflowStore from '../../store/workflowStore';
import { workflowDefAPI } from '../../services/api';
import localStorageService from '../../services/localStorage';
import './WorkflowEditor.css';

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
    isConfigPanelOpen
  } = useWorkflowStore();

  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchWorkflow(id);
    } else {
      // 新建工作流
      clearCanvas();
      setCurrentWorkflow(null);
      setWorkflowName('未命名工作流');
    }
  }, [id]);

  useEffect(() => {
    if (currentWorkflow) {
      setWorkflowName(currentWorkflow.name);
    }
  }, [currentWorkflow]);

  const fetchWorkflow = async (workflowId) => {
    try {
      const response = await workflowDefAPI.getWorkflow(workflowId);
      loadWorkflow(response.data);
    } catch (error) {
      // 后端不可用时尝试本地存储
      const localWorkflow = localStorageService.getWorkflow(workflowId);
      if (localWorkflow) {
        loadWorkflow(localWorkflow);
      } else {
        console.error('Failed to fetch workflow:', error);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const workflowData = {
        name: workflowName,
        description: currentWorkflow?.description || '',
        tags: currentWorkflow?.tags || [],
        status: currentWorkflow?.status || 'inactive',
        trigger: currentWorkflow?.trigger || { type: 'manual', config: {} },
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.data.type,
          name: node.data.label,
          position: node.position,
          config: node.data.config || {},
          disabled: false
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          label: edge.label,
          type: edge.type || 'default'
        })),
        variables: currentWorkflow?.variables || {},
        settings: currentWorkflow?.settings || {}
      };

      let response;
      try {
        if (id && id !== 'new') {
          response = await workflowDefAPI.updateWorkflow(id, workflowData);
        } else {
          response = await workflowDefAPI.createWorkflow(workflowData);
          navigate(`/workflows/${response.data.id}/edit`, { replace: true });
        }
        setCurrentWorkflow(response.data);
      } catch (apiError) {
        // 后端不可用时保存到本地
        if (id && id !== 'new') {
          workflowData.id = id;
        }
        const saved = localStorageService.saveWorkflow(workflowData);
        setCurrentWorkflow(saved);
        if (!id || id === 'new') {
          navigate(`/workflows/${saved.id}/edit`, { replace: true });
        }
      }
      alert('保存成功！');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert('保存失败：' + (error.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!id || id === 'new') {
      alert('请先保存工作流');
      return;
    }

    setExecuting(true);
    try {
      const response = await workflowDefAPI.executeWorkflow(id);
      alert('工作流已开始执行！');
      // 可以跳转到执行记录页面
      navigate(`/executions/${response.data.id}`);
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      alert('执行失败：' + (error.response?.data?.detail || error.message));
    } finally {
      setExecuting(false);
    }
  };

  const handleBack = () => {
    if (window.confirm('确定要离开吗？未保存的更改将丢失。')) {
      navigate('/workflows');
    }
  };

  return (
    <div className="workflow-editor">
      {/* 顶部工具栏 */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button onClick={handleBack} className="btn-icon" title="返回">
            ←
          </button>
          <div className="workflow-name-input">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="输入工作流名称"
            />
          </div>
          <span className="workflow-status">
            {currentWorkflow?.status === 'active' ? '🟢 已启用' : '⚪ 未启用'}
          </span>
        </div>

        <div className="toolbar-right">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? '保存中...' : '💾 保存'}
          </button>
          <button 
            onClick={handleExecute} 
            disabled={executing || !id || id === 'new'}
            className="btn btn-success"
            title={!id || id === 'new' ? '请先保存工作流' : ''}
          >
            {executing ? '执行中...' : '▶ 执行'}
          </button>
        </div>
      </div>

      {/* 主要编辑区域 */}
      <div className="editor-main">
        {isNodePanelOpen && <NodePanel />}
        
        <div className="editor-canvas">
          <WorkflowCanvas />
        </div>

        {isConfigPanelOpen && <ConfigPanel />}
      </div>

      {/* 快捷键提示 */}
      <div className="editor-shortcuts">
        <span>快捷键: </span>
        <kbd>Ctrl+S</kbd> 保存
        <kbd>Ctrl+Z</kbd> 撤销
        <kbd>Ctrl+Y</kbd> 重做
        <kbd>Delete</kbd> 删除
      </div>
    </div>
  );
};

export default WorkflowEditor;
