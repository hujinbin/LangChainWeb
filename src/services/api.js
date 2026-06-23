import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.token = token;
    config.headers.Authorization = token;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.data?.code === 400) {
      console.warn('登录状态无效或已过期');
    }
    return Promise.reject(error);
  }
);

const unwrap = (response) => response.data;

const normalizeWorkflow = (workflow = {}) => ({
  ...workflow,
  id: workflow.id || workflow._id,
  updated_at: workflow.updated_at || workflow.meta?.updatedAt || workflow.updatedAt,
  created_at: workflow.created_at || workflow.meta?.createdAt || workflow.createdAt,
});

const normalizeExecution = (execution = {}) => ({
  ...execution,
  id: execution.id || execution._id || execution.executionId,
  execute_time: execution.execute_time || execution.createdAt,
  workflow_type: execution.workflow_type || execution.workflowName,
  error_msg: execution.error_msg || execution.error,
});

const normalizeNodeType = (node = {}) => {
  const groupToCategory = {
    trigger: 'trigger',
    ai: 'ai',
    integration: 'integration',
    logic: 'logic',
    output: 'output',
  };

  const icons = {
    manualTrigger: '▶',
    webhookTrigger: '↗',
    llm: 'AI',
    knowledgeRetrieval: 'KB',
    httpRequest: 'HTTP',
    condition: '?',
    response: 'OUT',
  };

  return {
    ...node,
    category: node.category || groupToCategory[node.group] || 'other',
    icon: node.icon || icons[node.type] || '',
    config_schema: node.config_schema || {
      properties: Object.fromEntries((node.parameters || []).map((key) => [
        key,
        {
          type: key === 'temperature' || key === 'topK' ? 'number' : 'string',
          title: key,
          format: ['prompt', 'body', 'headers', 'template'].includes(key) ? 'textarea' : undefined,
        },
      ])),
      required: [],
    },
  };
};

export const aiWorkflowAPI = {
  getFeatures: () => apiClient.get('/api/aiWorkflow/features').then(unwrap),
  getNodeTypes: () => apiClient.get('/api/aiWorkflow/nodeTypes').then((res) => ({
    ...res.data,
    data: (res.data.data || []).map(normalizeNodeType),
  })),
  list: (params = {}) => apiClient.get('/api/aiWorkflow/list', { params }).then((res) => ({
    ...res.data,
    data: (res.data.data || []).map(normalizeWorkflow),
  })),
  detail: (id) => apiClient.get('/api/aiWorkflow/detail', { params: { id } }).then((res) => ({
    ...res.data,
    data: normalizeWorkflow(res.data.data),
  })),
  create: (data) => apiClient.post('/api/aiWorkflow/create', data).then(unwrap),
  update: (id, data) => apiClient.post('/api/aiWorkflow/update', { id, ...data }).then(unwrap),
  delete: (id) => apiClient.post('/api/aiWorkflow/delete', { id }).then(unwrap),
  validate: (data) => apiClient.post('/api/aiWorkflow/validate', data).then(unwrap),
  run: (id, input = {}) => apiClient.post('/api/aiWorkflow/run', { id, input, triggerType: 'manual' }).then((res) => ({
    ...res.data,
    data: normalizeExecution(res.data.data),
  })),
  executions: (params = {}) => apiClient.get('/api/aiWorkflow/executions', { params }).then((res) => ({
    ...res.data,
    data: (res.data.data || []).map(normalizeExecution),
  })),
};

export const workflowAPI = {
  getRecords: () => aiWorkflowAPI.executions().then((res) => res.data),
  getRecordDetail: (id) => aiWorkflowAPI.executions().then((res) => res.data.find((item) => item.id === id)),
};

export const workflowDefAPI = {
  getWorkflows: (params) => aiWorkflowAPI.list(params),
  createWorkflow: (data) => aiWorkflowAPI.create(data),
  getWorkflow: (id) => aiWorkflowAPI.detail(id),
  updateWorkflow: (id, data) => aiWorkflowAPI.update(id, data),
  deleteWorkflow: (id) => aiWorkflowAPI.delete(id),
  toggleWorkflow: (id, status) => aiWorkflowAPI.update(id, { status }),
  executeWorkflow: (id, input) => aiWorkflowAPI.run(id, input),
  validateWorkflow: (payload) => aiWorkflowAPI.validate(payload),
};

export const nodeAPI = {
  getNodeTypes: () => aiWorkflowAPI.getNodeTypes(),
  getNodeSchema: (type) => aiWorkflowAPI.getNodeTypes().then((res) => {
    const node = res.data.find((item) => item.type === type);
    return { data: node?.config_schema || null };
  }),
};

export const templateAPI = {
  getTemplates: async () => ({ data: [] }),
  useTemplate: async () => {
    throw new Error('模板市场尚未接入后端');
  },
};

export const configAPI = {
  getConfig: async () => ({ data: {} }),
  updateConfig: async () => ({ data: {} }),
  getKeysStatus: async () => ({ data: {} }),
};

export default apiClient;
