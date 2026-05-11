import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workflowDefAPI, templateAPI } from '../../services/api';
import dayjs from 'dayjs';
import './WorkflowList.css';

const WorkflowList = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('workflows'); // workflows | templates
  const [filterStatus, setFilterStatus] = useState('all'); // all | active | inactive

  useEffect(() => {
    fetchWorkflows();
    fetchTemplates();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const response = await workflowDefAPI.getWorkflows();
      setWorkflows(response.data);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await templateAPI.getTemplates();
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleCreateWorkflow = () => {
    navigate('/workflows/new/edit');
  };

  const handleEditWorkflow = (id) => {
    navigate(`/workflows/${id}/edit`);
  };

  const handleDeleteWorkflow = async (id, name) => {
    if (!window.confirm(`确定要删除工作流"${name}"吗？`)) {
      return;
    }

    try {
      await workflowDefAPI.deleteWorkflow(id);
      setWorkflows(workflows.filter(w => w.id !== id));
      alert('删除成功！');
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      alert('删除失败：' + (error.response?.data?.detail || error.message));
    }
  };

  const handleToggleWorkflow = async (id, currentStatus) => {
    try {
      await workflowDefAPI.toggleWorkflow(id);
      setWorkflows(workflows.map(w => 
        w.id === id ? { ...w, status: currentStatus === 'active' ? 'inactive' : 'active' } : w
      ));
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
      alert('操作失败：' + (error.response?.data?.detail || error.message));
    }
  };

  const handleExecuteWorkflow = async (id) => {
    try {
      const response = await workflowDefAPI.executeWorkflow(id);
      alert('工作流已开始执行！');
      navigate(`/executions/${response.data.id}`);
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      alert('执行失败：' + (error.response?.data?.detail || error.message));
    }
  };

  const handleUseTemplate = async (templateId, templateName) => {
    const name = prompt('请输入新工作流的名称:', `${templateName} - 副本`);
    if (!name) return;

    try {
      const response = await templateAPI.useTemplate(templateId, name);
      alert('创建成功！');
      navigate(`/workflows/${response.data.id}/edit`);
    } catch (error) {
      console.error('Failed to use template:', error);
      alert('创建失败：' + (error.response?.data?.detail || error.message));
    }
  };

  const filteredWorkflows = workflows.filter(w => {
    if (filterStatus === 'all') return true;
    return w.status === filterStatus;
  });

  return (
    <div className="workflow-list-page">
      {/* 头部 */}
      <div className="page-header">
        <div>
          <h1>工作流管理</h1>
          <p className="page-description">创建和管理自动化工作流</p>
        </div>
        <button onClick={handleCreateWorkflow} className="btn btn-primary btn-large">
          ➕ 创建工作流
        </button>
      </div>

      {/* 标签页 */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'workflows' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          我的工作流 ({workflows.length})
        </button>
        <button 
          className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          模板市场 ({templates.length})
        </button>
      </div>

      {/* 工作流列表 */}
      {activeTab === 'workflows' && (
        <>
          {/* 筛选器 */}
          <div className="filters">
            <button 
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              全部
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
              onClick={() => setFilterStatus('active')}
            >
              已启用
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'inactive' ? 'active' : ''}`}
              onClick={() => setFilterStatus('inactive')}
            >
              未启用
            </button>
          </div>

          {loading ? (
            <div className="loading">加载中...</div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>还没有工作流</h3>
              <p>创建你的第一个自动化工作流吧</p>
              <button onClick={handleCreateWorkflow} className="btn btn-primary">
                创建工作流
              </button>
            </div>
          ) : (
            <div className="workflow-grid">
              {filteredWorkflows.map(workflow => (
                <div key={workflow.id} className="workflow-card">
                  <div className="card-header">
                    <h3 className="workflow-name">{workflow.name}</h3>
                    <span className={`status-badge ${workflow.status}`}>
                      {workflow.status === 'active' ? '已启用' : '未启用'}
                    </span>
                  </div>

                  <p className="workflow-description">
                    {workflow.description || '暂无描述'}
                  </p>

                  <div className="workflow-meta">
                    <span>📦 {workflow.nodes?.length || 0} 个节点</span>
                    <span>🔗 {workflow.edges?.length || 0} 个连接</span>
                  </div>

                  <div className="workflow-footer">
                    <div className="workflow-time">
                      更新于 {dayjs(workflow.updated_at).format('YYYY-MM-DD HH:mm')}
                    </div>
                    <div className="workflow-actions">
                      <button 
                        onClick={() => handleEditWorkflow(workflow.id)}
                        className="btn-icon"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleExecuteWorkflow(workflow.id)}
                        className="btn-icon"
                        title="执行"
                      >
                        ▶️
                      </button>
                      <button 
                        onClick={() => handleToggleWorkflow(workflow.id, workflow.status)}
                        className="btn-icon"
                        title={workflow.status === 'active' ? '禁用' : '启用'}
                      >
                        {workflow.status === 'active' ? '⏸️' : '▶'}
                      </button>
                      <button 
                        onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                        className="btn-icon btn-danger"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 模板列表 */}
      {activeTab === 'templates' && (
        <div className="template-grid">
          {templates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>暂无模板</h3>
              <p>敬请期待更多模板</p>
            </div>
          ) : (
            templates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-thumbnail">
                  {template.thumbnail ? (
                    <img src={template.thumbnail} alt={template.name} />
                  ) : (
                    <div className="thumbnail-placeholder">📋</div>
                  )}
                </div>
                <div className="template-content">
                  <h3 className="template-name">{template.name}</h3>
                  <p className="template-description">
                    {template.description || '暂无描述'}
                  </p>
                  <div className="template-meta">
                    <span className="category-badge">{template.category}</span>
                    <span>使用 {template.usage_count} 次</span>
                  </div>
                  <button 
                    onClick={() => handleUseTemplate(template.id, template.name)}
                    className="btn btn-primary btn-block"
                  >
                    使用模板
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default WorkflowList;
