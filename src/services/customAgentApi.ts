import type { AxiosResponse } from 'axios';
import apiClient, { WORKFLOW_CREDITS_CHANGED } from './api';
import { asRecord } from '../types/api';
import type { ApiEnvelope, ApiError } from '../types/api';
import type { CustomAgent, CustomAgentCatalog, CustomAgentChat, CustomAgentConfig, CustomAgentMemory, CustomAgentMessage } from '../types/customAgent';

const ROOT = '/api/aiCustomAgents';
const path = (id: string) => `${ROOT}/${encodeURIComponent(id)}`;
function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): T {
  if (response.data?.code !== 200) {
    const error: ApiError = new Error(response.data?.msg || '智能体操作未完成，请重试');
    error.code = response.data?.code;
    error.data = asRecord(response.data?.data);
    error.response = response as AxiosResponse<ApiEnvelope<Record<string, unknown>>>;
    throw error;
  }
  return response.data.data;
}
export const customAgentAPI = {
  catalog: (signal?: AbortSignal) => apiClient.get<ApiEnvelope<CustomAgentCatalog>>(`${ROOT}/catalog`, { signal }).then(unwrap),
  list: (params: { page?: number; pageSize?: number; keyword?: string } = {}, signal?: AbortSignal) => apiClient.get<ApiEnvelope<{ items: CustomAgent[]; total: number; page: number; pageSize: number }>>(ROOT, { params, signal }).then(unwrap),
  create: (data: CustomAgentConfig) => apiClient.post<ApiEnvelope<CustomAgent>>(ROOT, data).then(unwrap),
  detail: (id: string, signal?: AbortSignal) => apiClient.get<ApiEnvelope<CustomAgent>>(path(id), { signal }).then(unwrap),
  update: (id: string, data: CustomAgentConfig & { revision: number }) => apiClient.patch<ApiEnvelope<CustomAgent>>(path(id), data).then(unwrap),
  delete: (id: string) => apiClient.delete<ApiEnvelope<unknown>>(path(id)).then(unwrap),
  publish: (id: string, revision: number) => apiClient.post<ApiEnvelope<CustomAgent>>(`${path(id)}/publish`, { revision }).then(unwrap),
  unpublish: (id: string, revision: number) => apiClient.post<ApiEnvelope<CustomAgent>>(`${path(id)}/unpublish`, { revision }).then(unwrap),
  chat: (id: string, data: { message: string; conversationId?: string; variables: Record<string, unknown>; revision?: number; mode: 'draft' | 'published' }, signal?: AbortSignal) => apiClient.post<ApiEnvelope<CustomAgentChat>>(`${path(id)}/chat`, data, { signal, timeout: 630000 }).then(unwrap).finally(() => window.dispatchEvent(new Event(WORKFLOW_CREDITS_CHANGED))),
  conversation: (id: string, conversationId: string, signal?: AbortSignal) => apiClient.get<ApiEnvelope<{ conversationId: string; messages: CustomAgentMessage[]; variables?: Record<string, unknown> }>>(`${path(id)}/conversations/${encodeURIComponent(conversationId)}`, { signal }).then(unwrap),
  clearConversation: (id: string, conversationId: string) => apiClient.delete<ApiEnvelope<unknown>>(`${path(id)}/conversations/${encodeURIComponent(conversationId)}`).then(unwrap),
  memory: (id: string, signal?: AbortSignal) => apiClient.get<ApiEnvelope<{ items: CustomAgentMemory[] }>>(`${path(id)}/memory`, { signal }).then(unwrap),
  clearMemory: (id: string) => apiClient.delete<ApiEnvelope<unknown>>(`${path(id)}/memory`).then(unwrap),
};
