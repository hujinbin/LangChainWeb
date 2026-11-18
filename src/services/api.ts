import axios from 'axios';
import type { AxiosResponse } from 'axios';
import {
  FLASH_MODEL_CATALOG,
  mergeNodeTypes,
  normalizeModelCatalog,
} from '../constants/nodeTypes';
import { WORKFLOW_TIMEOUT } from '../constants';
import { asRecord, normalizeError } from '../types/api';
import type { ApiEnvelope, ApiError, ErrorData } from '../types/api';
import type { WorkflowBilling, WorkflowCredits, WorkflowCreditLedger } from '../types/credits';
import type {
  Execution,
  GenerateWorkflowRequest,
  GenerateWorkflowResult,
  ModelCatalog,
  NodeOutput,
  NodeTypeMetadata,
  RunOptions,
  Workflow,
  WorkflowDefinitionNode,
  WorkflowEdge,
  WorkflowInput,
  WorkflowValidation,
} from '../types/workflow';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});
export const WORKFLOW_CREDITS_CHANGED = 'workflow-credits-changed';
const notifyCreditChange = () => window.dispatchEvent(new Event(WORKFLOW_CREDITS_CHANGED));

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
  (value: unknown) => {
    const error = normalizeError(value);
    if (error.response?.data?.msg) error.message = error.response.data.msg;
    return Promise.reject(error);
  }
);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
const identifier = (value: unknown): string | undefined =>
  text(value) || (number(value) !== undefined ? String(value) : undefined);

export function normalizeBilling(value: unknown): WorkflowBilling | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const billing = asRecord(value);
  if (!['settled', 'simulated', 'pending', 'released'].includes(String(billing.status))) return undefined;
  const nonnegative = (value: unknown) => {
    const count = number(value);
    return count !== undefined && count >= 0 ? count : undefined;
  };
  return {
    pointsCharged: nonnegative(billing.pointsCharged) ?? 0,
    inputTokens: nonnegative(billing.inputTokens) ?? null,
    outputTokens: nonnegative(billing.outputTokens) ?? null,
    totalTokens: nonnegative(billing.totalTokens) ?? null,
    billableTokens: nonnegative(billing.billableTokens) ?? 0,
    imageCount: nonnegative(billing.imageCount) ?? 0,
    estimated: billing.estimated === true,
    status: billing.status as WorkflowBilling['status'],
    ruleVersion: text(billing.ruleVersion),
  };
}

function normalizeDefinitionNode(
  value: unknown,
  index: number
): WorkflowDefinitionNode {
  const node = asRecord(value);
  const position = asRecord(node.position);
  const data = asRecord(node.data);
  const type = text(data.type) || text(node.type) || '';
  return {
    ...node,
    id: identifier(node.id) || `node-${index}`,
    type: text(node.type) || type,
    name: text(node.name),
    category: text(node.category),
    icon: text(node.icon),
    position: {
      x: number(position.x) ?? 120 + index * 290,
      y: number(position.y) ?? 180,
    },
    parameters: node.parameters ? asRecord(node.parameters) : undefined,
    config: node.config ? asRecord(node.config) : undefined,
    data: node.data
      ? {
          ...data,
          type,
          label: text(data.label),
          category: text(data.category),
          icon: text(data.icon),
          config: asRecord(data.config || node.parameters || node.config),
        }
      : undefined,
  };
}

function normalizeWorkflowEdge(value: unknown, index: number): WorkflowEdge {
  const edge = asRecord(value);
  return {
    ...edge,
    id: identifier(edge.id) || `edge-${index}`,
    source: identifier(edge.source) || identifier(edge.from) || '',
    target: identifier(edge.target) || identifier(edge.to) || '',
    sourceHandle: text(edge.sourceHandle),
    targetHandle: text(edge.targetHandle),
    type: text(edge.type),
  };
}

function normalizeNodeOutput(value: unknown): NodeOutput {
  const output = asRecord(value);
  return {
    ...output,
    text: text(output.text),
    urls: Array.isArray(output.urls) ? strings(output.urls) : undefined,
    images: Array.isArray(output.images)
      ? output.images.flatMap<string | { url: string }>((image: unknown) => {
          if (typeof image === 'string') return [image];
          const url = text(asRecord(image).url);
          return url ? [{ url }] : [];
        })
      : undefined,
    videoId: text(output.videoId),
    videoUrl: text(output.videoUrl),
    status: text(output.status),
    error: text(output.error),
    searchResults: Array.isArray(output.searchResults)
      ? output.searchResults.map((value) => {
          const item = asRecord(value);
          return { url: text(item.url) || '', title: text(item.title) };
        })
      : undefined,
  };
}

function normalizeValidation(value: unknown): WorkflowValidation | undefined {
  if (!value) return undefined;
  const validation = asRecord(value);
  return {
    valid: validation.valid === true,
    errors: strings(validation.errors),
    warnings: strings(validation.warnings),
  };
}

export const normalizeWorkflow = (value: unknown = {}): Workflow => {
  const workflow = asRecord(value);
  const meta = asRecord(workflow.meta);
  return {
    ...workflow,
    id: identifier(workflow.id) || identifier(workflow._id),
    name: text(workflow.name),
    description: text(workflow.description),
    status: text(workflow.status),
    nodes: Array.isArray(workflow.nodes)
      ? workflow.nodes.map(normalizeDefinitionNode)
      : [],
    edges: Array.isArray(workflow.edges)
      ? workflow.edges.map(normalizeWorkflowEdge)
      : [],
    input: asRecord(workflow.input),
    variables: asRecord(workflow.variables),
    settings: workflow.settings
      ? { timeoutMs: number(asRecord(workflow.settings).timeoutMs) }
      : undefined,
    tags: strings(workflow.tags),
    latestValidation: normalizeValidation(workflow.latestValidation),
    validation: normalizeValidation(workflow.validation),
    runStats: workflow.runStats
      ? { totalRuns: number(asRecord(workflow.runStats).totalRuns) }
      : undefined,
    updated_at:
      text(workflow.updated_at) ||
      text(meta.updatedAt) ||
      text(workflow.updatedAt),
    created_at:
      text(workflow.created_at) ||
      text(meta.createdAt) ||
      text(workflow.createdAt),
    _source: 'server',
    isLocal: false,
  };
};

export const normalizeExecution = (value: unknown = {}): Execution => {
  const execution = asRecord(value);
  return {
    ...execution,
    id:
      text(execution.id) || text(execution._id) || text(execution.executionId),
    status: text(execution.status) || '',
    durationMs: number(execution.durationMs),
    error: text(execution.error),
    execute_time: text(execution.execute_time) || text(execution.createdAt),
    workflow_type:
      text(execution.workflow_type) || text(execution.workflowName),
    error_msg: text(execution.error_msg) || text(execution.error),
    simulated:
      typeof execution.simulated === 'boolean' ? execution.simulated : true,
    billing: normalizeBilling(execution.billing),
    nodeResults: Array.isArray(execution.nodeResults)
      ? execution.nodeResults.map((value) => {
          const node = asRecord(value);
          return {
            ...node,
            nodeId: text(node.nodeId),
            nodeName: text(node.nodeName),
            nodeType: text(node.nodeType) || '',
            status: text(node.status) || '',
            output: node.output ? normalizeNodeOutput(node.output) : undefined,
            error: text(node.error),
            billing: normalizeBilling(node.billing),
          };
        })
      : [],
  };
};

function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): ApiEnvelope<T> {
  const payload = response.data;
  if (!payload || payload.code !== 200) {
    const data = asRecord(payload?.data) as ErrorData;
    const error: ApiError = new Error(
      data.error || payload?.msg || '工作流请求失败'
    );
    error.code = payload?.code;
    error.isBusinessError = true;
    error.response = response as AxiosResponse<ApiEnvelope<ErrorData>>;
    error.data = data;
    if (data.executionId || (data._id && data.nodeResults))
      error.execution = normalizeExecution(data);
    throw error;
  }
  return payload;
}

const timeoutBudget = (value = WORKFLOW_TIMEOUT.DEFAULT): number => {
  if (
    !Number.isInteger(value) ||
    value < WORKFLOW_TIMEOUT.MIN ||
    value > WORKFLOW_TIMEOUT.MAX
  )
    throw new Error('timeoutMs 需要为 1000 至 600000 毫秒');
  return value;
};
const validateSettings = (data: Partial<Workflow>): Partial<Workflow> => {
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
type QueryParams = Record<string, unknown>;
type RequestOptions = { signal?: AbortSignal };

export const aiWorkflowAPI = {
  credits: (options: RequestOptions = {}) =>
    apiClient
      .get<ApiEnvelope<WorkflowCredits>>('/api/aiWorkflow/credits', { signal: options.signal })
      .then(unwrap),
  creditLedger: (params: QueryParams = {}, options: RequestOptions = {}) =>
    apiClient
      .get<ApiEnvelope<WorkflowCreditLedger>>('/api/aiWorkflow/credits/ledger', { params, signal: options.signal })
      .then(unwrap),
  getFeatures: () =>
    apiClient
      .get<ApiEnvelope<Record<string, unknown>>>('/api/aiWorkflow/features')
      .then(unwrap),
  getModels: () =>
    apiClient
      .get<ApiEnvelope<unknown>>('/api/aiWorkflow/models')
      .then(unwrap)
      .then(
        (payload): ApiEnvelope<ModelCatalog> => ({
          ...payload,
          data: normalizeModelCatalog(payload.data),
        })
      ),
  getNodeTypes: () =>
    apiClient
      .get<ApiEnvelope<unknown>>('/api/aiWorkflow/nodeTypes')
      .then(unwrap)
      .then(
        (payload): ApiEnvelope<NodeTypeMetadata[]> => ({
          ...payload,
          data: mergeNodeTypes(payload.data),
        })
      ),
  list: (params: QueryParams = {}) =>
    apiClient
      .get<ApiEnvelope<unknown>>('/api/aiWorkflow/list', { params })
      .then(unwrap)
      .then(
        (payload): ApiEnvelope<Workflow[]> => ({
          ...payload,
          data: Array.isArray(payload.data)
            ? payload.data.map(normalizeWorkflow)
            : [],
        })
      ),
  detail: (id: string) =>
    apiClient
      .get<ApiEnvelope<unknown>>('/api/aiWorkflow/detail', { params: { id } })
      .then(unwrap)
      .then(
        (payload): ApiEnvelope<Workflow> => ({
          ...payload,
          data: normalizeWorkflow(payload.data),
        })
      ),
  create: async (data: Partial<Workflow>) =>
    apiClient
      .post<
        ApiEnvelope<Workflow>
      >('/api/aiWorkflow/create', validateSettings(data))
      .then(unwrap),
  update: async (id: string, data: Partial<Workflow>) =>
    apiClient
      .post<
        ApiEnvelope<Workflow>
      >('/api/aiWorkflow/update', { ...validateSettings(data), id })
      .then(unwrap),
  delete: (id: string) =>
    apiClient
      .post<ApiEnvelope<unknown>>('/api/aiWorkflow/delete', { id })
      .then(unwrap),
  validate: (data: Partial<Workflow>) =>
    apiClient
      .post<ApiEnvelope<WorkflowValidation>>('/api/aiWorkflow/validate', data)
      .then(unwrap),
  generateWorkflow: async (
    data: GenerateWorkflowRequest,
    options: RequestOptions = {}
  ) => {
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
      .post<
        ApiEnvelope<GenerateWorkflowResult>
      >('/api/aiWorkflow/generate', data, { timeout: 210000, signal: options.signal })
      .then(unwrap)
      .finally(notifyCreditChange);
  },
  run: async (
    id: string,
    input: WorkflowInput = {},
    options: RunOptions = {}
  ) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('input 需要为对象');
    const simulate = options.simulate === undefined ? false : options.simulate;
    if (typeof simulate !== 'boolean') throw new Error('simulate 需要为布尔值');
    const budget = timeoutBudget(options.timeoutMs);
    const response = await apiClient.post<ApiEnvelope<unknown>>(
      '/api/aiWorkflow/run',
      { id, input, simulate, triggerType: options.triggerType || 'manual' },
      {
        // 后端总超时由保存的 settings 控制，预留时间用于收取终态执行记录。
        timeout: budget + 30000,
        signal: options.signal,
      }
    ).finally(notifyCreditChange);
    return unwrap({
      ...response,
      data: { ...response.data, data: normalizeExecution(response.data?.data) },
    });
  },
  executions: (params: QueryParams = {}) =>
    apiClient
      .get<ApiEnvelope<unknown>>('/api/aiWorkflow/executions', { params })
      .then(unwrap)
      .then(
        (payload): ApiEnvelope<Execution[]> => ({
          ...payload,
          data: Array.isArray(payload.data)
            ? payload.data.map(normalizeExecution)
            : [],
        })
      ),
  execution: (id: string) =>
    apiClient
      .get<ApiEnvelope<unknown>>('/api/aiWorkflow/execution', {
        params: { id },
      })
      .then(unwrap)
      .then(
        (payload): ApiEnvelope<Execution> => ({
          ...payload,
          data: normalizeExecution(payload.data),
        })
      ),
};

export const workflowAPI = {
  getRecords: (params?: QueryParams) =>
    aiWorkflowAPI.executions(params).then((res) => res.data),
  getRecordDetail: (id: string) =>
    aiWorkflowAPI.execution(id).then((res) => res.data),
};
export const workflowDefAPI = {
  getWorkflows: (params?: QueryParams) => aiWorkflowAPI.list(params),
  createWorkflow: (data: Partial<Workflow>) => aiWorkflowAPI.create(data),
  getWorkflow: (id: string) => aiWorkflowAPI.detail(id),
  updateWorkflow: (id: string, data: Partial<Workflow>) =>
    aiWorkflowAPI.update(id, data),
  deleteWorkflow: (id: string) => aiWorkflowAPI.delete(id),
  toggleWorkflow: (id: string, status: string) =>
    aiWorkflowAPI.update(id, { status }),
  executeWorkflow: (id: string, input?: WorkflowInput, options?: RunOptions) =>
    aiWorkflowAPI.run(id, input, options),
  validateWorkflow: (payload: Partial<Workflow>) =>
    aiWorkflowAPI.validate(payload),
};
export const nodeAPI = {
  getModels: () => aiWorkflowAPI.getModels(),
  getNodeTypes: () => aiWorkflowAPI.getNodeTypes(),
  getNodeSchema: async (type: string) => {
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
  queryVideo: async (
    videoId: string,
    options: RequestOptions = {}
  ): Promise<unknown> => {
    if (typeof videoId !== 'string' || !videoId.trim())
      throw new Error('缺少有效的 video_id');
    const payload = await apiClient
      .get<
        ApiEnvelope<unknown>
      >('/api/ai/videos', { params: { video_id: videoId }, signal: options.signal })
      .then(unwrap);
    return payload.data;
  },
};
export const templateAPI = {
  getTemplates: async () => ({ data: [] as Workflow[] }),
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
