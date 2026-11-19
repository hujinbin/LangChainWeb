import type { AxiosResponse } from 'axios';
import apiClient from './api';
import { asRecord } from '../types/api';
import type { ApiEnvelope } from '../types/api';

export interface WorkflowHttpTool { id: string; name: string; description: string; url: string; method: 'GET' | 'POST'; headers: Record<string, string>; parameters: Record<string, unknown> }
function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>) { if (response.data?.code !== 200) throw new Error(response.data?.msg || '工作流资源操作未完成，请重试'); return response.data.data; }
const ROOT = '/api/aiWorkflow';
export const workflowResourcesAPI = {
  tools: (signal?: AbortSignal) => apiClient.get<ApiEnvelope<unknown>>(`${ROOT}/tools`, { signal }).then(unwrap).then(data => {
    const record = asRecord(data); const list = Array.isArray(data) ? data : record.items || record.list || record.tools;
    return (Array.isArray(list) ? list : []).map(value => { const item = asRecord(value); return { ...item, id: String(item.id || item._id || '') } as WorkflowHttpTool; });
  }),
  saveTool: (data: Omit<WorkflowHttpTool, 'id'> & { id?: string }) => apiClient.post<ApiEnvelope<unknown>>(`${ROOT}/tools`, data).then(unwrap),
  deleteTool: (id: string) => apiClient.delete<ApiEnvelope<unknown>>(`${ROOT}/tools/${encodeURIComponent(id)}`).then(unwrap),
  tables: (signal?: AbortSignal) => apiClient.get<ApiEnvelope<unknown>>(`${ROOT}/data/tables`, { signal }).then(unwrap).then(data => {
    const record = asRecord(data); const list = Array.isArray(data) ? data : record.items || record.list || record.tables;
    return (Array.isArray(list) ? list : []).map(value => typeof value === 'string' ? value : String(asRecord(value).name || asRecord(value).table || '')).filter(Boolean);
  }),
  createTable: (name: string) => apiClient.post<ApiEnvelope<unknown>>(`${ROOT}/data/tables`, { name }).then(unwrap),
  query: (table: string, data: { where: Record<string, unknown>; limit: number }) => apiClient.post<ApiEnvelope<unknown>>(`${ROOT}/data/tables/${encodeURIComponent(table)}/query`, data).then(unwrap),
  insert: (table: string, records: Record<string, unknown>[]) => apiClient.post<ApiEnvelope<unknown>>(`${ROOT}/data/tables/${encodeURIComponent(table)}/records`, { records }).then(unwrap),
};
