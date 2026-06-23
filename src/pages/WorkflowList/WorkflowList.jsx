import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { workflowDefAPI } from '../../services/api';
import localStorageService from '../../services/localStorage';
import './WorkflowList.css';

const STATUS_LABELS = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

const WorkflowList = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async (params = {}) => {
    setLoading(true);
    try {
      const response = await workflowDefAPI.getWorkflows(params);
      setWorkflows(response.data || []);
    } catch (error) {
      console.warn('后端不可用，使用本地工作流缓存', error);
      setWorkflows(localStorageService.getWorkflows());
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchWorkflows({
      keyword: keyword || undefined,
      status: filterStatus === 'all' ? undefined : filterStatus,
    });
  };

  const handleCreateWorkflow = () => {
    navigate('/workflows/new/edit');
  };

  const handleEditWorkflow = (id) => {
    navigate(`/workflows/${id}/edit`);
  };

  const handleDeleteWorkflow = async (id, name) => {
    if (!window.confirm(`确定删除工作流"${name}"吗？`)) return;

    try {
      await workflowDefAPI.deleteWorkflow(id);
    } catch (error) {
      localStorageService.deleteWorkflow(id);
    }
    setWorkflows(workflows.filter((workflow) => workflow.id !== id));
  };

  const handlePublishWorkflow = async (workflow) => {
    const nextStatus = workflow.status === 'published' ? 'draft' : 'published';
    try {
      await workflowDefAPI.toggleWorkflow(workflow.id, nextStatus);
      setWorkflows(workflows.map((item) => (
        item.id === workflow.id ? { ...item, status: nextStatus } : item
      )));
    } catch (error) {
      alert(`状态更新失败：${error.response?.data?.msg || error.message}`);
    }
  };

  const handleExecuteWorkflow = async (id) => {
    try {
      const response = await workflowDefAPI.executeWorkflow(id, {
        question: '前端调试运行',
      });
      alert(response.msg || '运行完成');
      await fetchWorkflows();
      navigate(`/executions/${response.data.id}`);
    } catch (error) {
      alert(`执行失败：${error.response?.data?.msg || error.message}`);
    }
  };

  const visibleWorkflows = workflows.filter((workflow) => {
    if (filterStatus !== 'all' && workflow.status !== filterStatus) return false;
    if (!keyword) return true;
    return `${workflow.name || ''}${workflow.description || ''}`.toLowerCase().includes(keyword.toLowerCase());
  });

  return (
    <div className="workflow-list-page">
      <div className="page-header">
        <div>
          <h1>AI 工作流平台</h1>
          <p className="page-description">创建、编排、校验和运行 AI 自动化流程</p>
        </div>
        <button onClick={handleCreateWorkflow} className="btn btn-primary btn-large">
          创建工作流
        </button>
      </div>

      <div className="filters">
        {['all', 'draft', 'published', 'archived'].map((status) => (
          <button
            key={status}
            className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
            onClick={() => setFilterStatus(status)}
          >
            {status === 'all' ? '全部' : STATUS_LABELS[status]}
          </button>
        ))}
        <input
          className="workflow-search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
          placeholder="搜索名称或说明"
        />
        <button className="filter-btn" onClick={handleSearch}>搜索</button>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : visibleWorkflows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">WF</div>
          <h3>还没有工作流</h3>
          <p>先创建一个节点流程，再进入编辑器拖拽编排。</p>
          <button onClick={handleCreateWorkflow} className="btn btn-primary">
            创建工作流
          </button>
        </div>
      ) : (
        <div className="workflow-grid">
          {visibleWorkflows.map((workflow) => (
            <div key={workflow.id} className="workflow-card">
              <div className="card-header">
                <h3 className="workflow-name">{workflow.name}</h3>
                <span className={`status-badge ${workflow.status}`}>
                  {STATUS_LABELS[workflow.status] || workflow.status}
                </span>
              </div>

              <p className="workflow-description">
                {workflow.description || '暂无说明'}
              </p>

              <div className="workflow-meta">
                <span>{workflow.nodes?.length || 0} 节点</span>
                <span>{workflow.edges?.length || 0} 连线</span>
                <span className={workflow.latestValidation?.valid ? 'valid-text' : 'invalid-text'}>
                  {workflow.latestValidation?.valid ? '校验通过' : '待校验'}
                </span>
              </div>

              <div className="workflow-meta">
                <span>运行 {workflow.runStats?.totalRuns || 0} 次</span>
                <span>成功 {workflow.runStats?.successRuns || 0}</span>
                <span>失败 {workflow.runStats?.failedRuns || 0}</span>
              </div>

              <div className="workflow-footer">
                <div className="workflow-time">
                  更新于 {workflow.updated_at ? dayjs(workflow.updated_at).format('YYYY-MM-DD HH:mm') : '-'}
                </div>
                <div className="workflow-actions">
                  <button onClick={() => handleEditWorkflow(workflow.id)} className="btn-icon" title="编辑">
                    编辑
                  </button>
                  <button onClick={() => handleExecuteWorkflow(workflow.id)} className="btn-icon" title="运行">
                    运行
                  </button>
                  <button onClick={() => handlePublishWorkflow(workflow)} className="btn-icon" title="发布/撤回">
                    {workflow.status === 'published' ? '撤回' : '发布'}
                  </button>
                  <button onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)} className="btn-icon btn-danger" title="删除">
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowList;
