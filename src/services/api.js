import axios from 'axios';
import {
  FLASH_MODEL_CATALOG,
  mergeNodeTypes,
  normalizeModelCatalog,
} from '../constants/nodeTypes';
import { WORKFLOW_TIMEOUT } from '../constants';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
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
    if (error.response?.data?.msg) error.message = error.response.data.msg;
    return Promise.reject(error);
  }
);

export const normalizeWorkflow = (workflow = {}) => ({
  ...workflow,
  id: workflow.id || workflow._id,
  updated_at:
    workflow.updated_at || workflow.meta?.updatedAt || workflow.updatedAt,
  created_at:
    workflow.created_at || workflow.meta?.createdAt || workflow.createdAt,
  _source: 'server',
  isLocal: false,
});

export const normalizeExecution = (execution = {}) => ({
  ...execution,
  id: execution.id || execution._id || execution.executionId,
  execute_time: execution.execute_time || execution.createdAt,
  workflow_type: execution.workflow_type || execution.workflowName,
  error_msg: execution.error_msg || execution.error,
  simulated: execution.simulated ?? true,
});

const unwrap = (response) => {
  const payload = response.data;
  if (!payload || payload.code !== 200) {
    const error = new Error(
      payload?.data?.error || payload?.msg || '工作流请求失败'
    );
    error.code = payload?.code;
    error.isBusinessError = true;
    error.response = response;
    error.data = payload?.data;
    if (error.data?.executionId || (error.data?._id && error.data?.nodeResults))
      error.execution = normalizeExecution(error.data);
    throw error;
  }
  return payload;
};

const timeoutBudget = (value = WORKFLOW_TIMEOUT.DEFAULT) => {
  if (
    !Number.isInteger(value) ||
    value < WORKFLOW_TIMEOUT.MIN ||
    value > WORKFLOW_TIMEOUT.MAX
  ) {
    throw new Error('timeoutMs 需要为 1000 至 600000 毫秒');
  }
  return value;
};

const validateSettings = (data) => {
  if (data.settings !== undefined) {
    if (
      !data.settings ||
      typeof data.settings !== 'object' ||
      Array.isArray(data.settings)
    )
      throw new Error('settings 需要为对象');
    if (data.settings.timeoutMs !== undefined)
      timeoutBudget(data.settings.timeoutMs);
  }
  return data;
};

export const aiWorkflowAPI = {
  getFeatures: () => apiClient.get('/api/aiWorkflow/features').then(unwrap),
  getModels: () =>
    apiClient
      .get('/api/aiWorkflow/models')
      .then(unwrap)
      .then((payload) => ({
        ...payload,
        data: normalizeModelCatalog(payload.data),
      })),
  getNodeTypes: () =>
    apiClient
      .get('/api/aiWorkflow/nodeTypes')
      .then(unwrap)
      .then((payload) => ({ ...payload, data: mergeNodeTypes(payload.data) })),
  list: (params = {}) =>
    apiClient
      .get('/api/aiWorkflow/list', { params })
      .then(unwrap)
      .then((payload) => ({
        ...payload,
        data: (payload.data || []).map(normalizeWorkflow),
      })),
  detail: (id) =>
    apiClient
      .get('/api/aiWorkflow/detail', { params: { id } })
      .then(unwrap)
      .then((payload) => ({
        ...payload,
        data: normalizeWorkflow(payload.data),
      })),
  create: async (data) =>
    apiClient
      .post('/api/aiWorkflow/create', validateSettings(data))
      .then(unwrap),
  update: async (id, data) =>
    apiClient
      .post('/api/aiWorkflow/update', { ...validateSettings(data), id })
      .then(unwrap),
  delete: (id) => apiClient.post('/api/aiWorkflow/delete', { id }).then(unwrap),
  validate: (data) =>
    apiClient.post('/api/aiWorkflow/validate', data).then(unwrap),
  generateWorkflow: async (data, options = {}) => {
    if (typeof data.message !== 'string' || !data.message.trim())
      throw new Error('请先描述工作流需求');
    if (
      data.model !== undefined &&
      !FLASH_MODEL_CATALOG.text.includes(data.model)
    )
      throw new Error('请选择 Flash 文本模型');
    if (data.search !== undefined && typeof data.search !== 'boolean')
      throw new Error('联网开关需要为布尔值');
    return apiClient
      .post('/api/aiWorkflow/generate', data, {
        timeout: 210000,
        signal: options.signal,
      })
      .then(unwrap);
  },
  run: async (id, input = {}, options = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('input 需要为对象');
    const simulate = options.simulate === undefined ? false : options.simulate;
    if (typeof simulate !== 'boolean') throw new Error('simulate 需要为布尔值');
    const budget = timeoutBudget(options.timeoutMs);
    const response = await apiClient.post(
      '/api/aiWorkflow/run',
      { id, input, simulate, triggerType: options.triggerType || 'manual' },
      {
        // 后端总超时由保存的 settings 控制，预留时间用于收取终态执行记录。
        timeout: budget + 30000,
        signal: options.signal,
      }
    );
    const payload = {
      ...response.data,
      data: normalizeExecution(response.data?.data),
    };
    return unwrap({ ...response, data: payload });
  },
  executions: (params = {}) =>
    apiClient
      .get('/api/aiWorkflow/executions', { params })
      .then(unwrap)
      .then((payload) => ({
        ...payload,
        data: (payload.data || []).map(normalizeExecution),
      })),
  execution: (id) =>
    apiClient
      .get('/api/aiWorkflow/execution', { params: { id } })
      .then(unwrap)
      .then((payload) => ({
        ...payload,
        data: normalizeExecution(payload.data),
      })),
};

export const workflowAPI = {
  getRecords: (params) =>
    aiWorkflowAPI.executions(params).then((res) => res.data),
  getRecordDetail: (id) => aiWorkflowAPI.execution(id).then((res) => res.data),
};

export const workflowDefAPI = {
  getWorkflows: (params) => aiWorkflowAPI.list(params),
  createWorkflow: (data) => aiWorkflowAPI.create(data),
  getWorkflow: (id) => aiWorkflowAPI.detail(id),
  updateWorkflow: (id, data) => aiWorkflowAPI.update(id, data),
  deleteWorkflow: (id) => aiWorkflowAPI.delete(id),
  toggleWorkflow: (id, status) => aiWorkflowAPI.update(id, { status }),
  executeWorkflow: (id, input, options) =>
    aiWorkflowAPI.run(id, input, options),
  validateWorkflow: (payload) => aiWorkflowAPI.validate(payload),
};

export const nodeAPI = {
  getModels: () => aiWorkflowAPI.getModels(),
  getNodeTypes: () => aiWorkflowAPI.getNodeTypes(),
  getNodeSchema: async (type) => {
    const [types, catalog] = await Promise.all([
      aiWorkflowAPI.getNodeTypes(),
      aiWorkflowAPI.getModels(),
    ]);
    const node = mergeNodeTypes(types.data, catalog.data).find(
      (item) => item.type === type
    );
    return { code: 200, data: node?.config_schema || null };
  },
};

export const mediaAPI = {
  queryVideo: async (videoId, options = {}) => {
    if (typeof videoId !== 'string' || !videoId.trim())
      throw new Error('缺少有效的 video_id');
    const payload = await apiClient
      .get('/api/ai/videos', {
        params: { video_id: videoId },
        signal: options.signal,
      })
      .then(unwrap);
    return payload.data;
  },
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
