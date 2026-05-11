import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 工作流执行相关
export const workflowAPI = {
  // 触发工作流
  trigger: (workflowType) => 
    apiClient.post('/api/workflow/trigger', { workflow_type: workflowType }),
  
  // 获取执行记录列表
  getRecords: () => 
    apiClient.get('/api/workflow/records'),
  
  // 获取执行记录详情
  getRecordDetail: (id) => 
    apiClient.get(`/api/workflow/records/${id}`),
  
  // 删除执行记录
  deleteRecord: (id) => 
    apiClient.delete(`/api/workflow/records/${id}`),
  
  // 重试失败的执行
  retryRecord: (id) => 
    apiClient.post(`/api/workflow/records/${id}/retry`),
};

// 工作流定义管理
export const workflowDefAPI = {
  // 获取工作流列表
  getWorkflows: (params) => 
    apiClient.get('/api/workflows', { params }),
  
  // 创建工作流
  createWorkflow: (data) => 
    apiClient.post('/api/workflows', data),
  
  // 获取工作流详情
  getWorkflow: (id) => 
    apiClient.get(`/api/workflows/${id}`),
  
  // 更新工作流
  updateWorkflow: (id, data) => 
    apiClient.put(`/api/workflows/${id}`, data),
  
  // 删除工作流
  deleteWorkflow: (id) => 
    apiClient.delete(`/api/workflows/${id}`),
  
  // 启用/禁用工作流
  toggleWorkflow: (id) => 
    apiClient.post(`/api/workflows/${id}/toggle`),
  
  // 执行工作流
  executeWorkflow: (id) => 
    apiClient.post(`/api/workflows/${id}/execute`),
};

// 节点管理
export const nodeAPI = {
  // 获取所有节点类型
  getNodeTypes: () => 
    apiClient.get('/api/nodes'),
  
  // 获取节点类型详情
  getNodeType: (type) => 
    apiClient.get(`/api/nodes/${type}`),
  
  // 获取节点配置Schema
  getNodeSchema: (type) => 
    apiClient.get(`/api/nodes/${type}/schema`),
  
  // 测试节点
  testNode: (type, config) => 
    apiClient.post(`/api/nodes/${type}/test`, config),
  
  // 获取节点文档
  getNodeDocs: (type) => 
    apiClient.get(`/api/nodes/${type}/docs`),
};

// 模板管理
export const templateAPI = {
  // 获取模板列表
  getTemplates: (params) => 
    apiClient.get('/api/templates', { params }),
  
  // 创建模板
  createTemplate: (data) => 
    apiClient.post('/api/templates', data),
  
  // 获取模板详情
  getTemplate: (id) => 
    apiClient.get(`/api/templates/${id}`),
  
  // 使用模板创建工作流
  useTemplate: (id, name) => 
    apiClient.post(`/api/templates/${id}/use`, null, { params: { name } }),
  
  // 删除模板
  deleteTemplate: (id) => 
    apiClient.delete(`/api/templates/${id}`),
};

// 配置管理
export const configAPI = {
  // 获取系统配置
  getConfig: () => 
    apiClient.get('/api/config'),
  
  // 更新系统配置
  updateConfig: (data) => 
    apiClient.put('/api/config', data),
  
  // 获取API密钥配置状态
  getKeysStatus: () => 
    apiClient.get('/api/config/keys'),
};

export default apiClient;
