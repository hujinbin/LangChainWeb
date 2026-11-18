import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import apiClient from './api';
import { normalizeError } from '../types/api';
import type { ApiEnvelope, ApiError, ErrorData } from '../types/api';
import type {
  DocumentDetail,
  ImportPreview,
  KnowledgeBase,
  KnowledgeBaseInput,
  KnowledgeConfig,
  KnowledgeDocument,
  KnowledgeImportInput,
  KnowledgePage,
  RetrievalResult,
} from '../types/knowledge';

const ROOT = '/api/aiKnowledge';
const basePath = (id: string) => `${ROOT}/bases/${encodeURIComponent(id)}`;
const documentPath = (id: string, documentId: string) =>
  `${basePath(id)}/documents/${encodeURIComponent(documentId)}`;
type QueryParams = Record<string, unknown>;
type ImportData = KnowledgeImportInput | FormData;

function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): ApiEnvelope<T> {
  const payload = response.data;
  if (!payload || payload.code !== 200) {
    const error: ApiError = new Error(
      payload?.msg || '知识库请求失败，请稍后重试'
    );
    error.code = payload?.code;
    error.isBusinessError = true;
    error.data = payload?.data as ErrorData | undefined;
    throw error;
  }
  return payload;
}
function rejectRequest(value: unknown): never {
  const error = normalizeError(value);
  const payload = error.response?.data;
  if (!error.isBusinessError && error.code !== 'ERR_CANCELED') {
    error.message =
      typeof payload?.msg === 'string'
        ? payload.msg
        : '知识库服务暂时无法连接，请稍后重试';
    error.data = payload?.data;
    error.isBusinessError = Boolean(payload);
  }
  throw error;
}
function importOptions(
  data: ImportData,
  options: AxiosRequestConfig
): AxiosRequestConfig {
  return {
    timeout: 180000,
    ...options,
    // 文件请求交由浏览器写入 multipart 边界，沿用现有鉴权拦截器。
    ...(data instanceof FormData
      ? { headers: { 'Content-Type': undefined } }
      : {}),
  };
}
export const knowledgeAPI = {
  config: (options: AxiosRequestConfig = {}) =>
    apiClient
      .get<ApiEnvelope<KnowledgeConfig>>(`${ROOT}/config`, options)
      .then(unwrap)
      .catch(rejectRequest),
  list: (params: QueryParams = {}, options: AxiosRequestConfig = {}) =>
    apiClient
      .get<ApiEnvelope<KnowledgePage<KnowledgeBase>>>(`${ROOT}/bases`, {
        ...options,
        params,
      })
      .then(unwrap)
      .catch(rejectRequest),
  create: (data: KnowledgeBaseInput) =>
    apiClient
      .post<ApiEnvelope<KnowledgeBase>>(`${ROOT}/bases`, data)
      .then(unwrap)
      .catch(rejectRequest),
  detail: (id: string, options: AxiosRequestConfig = {}) =>
    apiClient
      .get<ApiEnvelope<KnowledgeBase>>(basePath(id), options)
      .then(unwrap)
      .catch(rejectRequest),
  update: (id: string, data: Partial<KnowledgeBaseInput>) =>
    apiClient
      .patch<ApiEnvelope<KnowledgeBase>>(basePath(id), data)
      .then(unwrap)
      .catch(rejectRequest),
  delete: (id: string) =>
    apiClient
      .delete<ApiEnvelope<unknown>>(basePath(id))
      .then(unwrap)
      .catch(rejectRequest),
  documents: (
    id: string,
    params: QueryParams = {},
    options: AxiosRequestConfig = {}
  ) =>
    apiClient
      .get<ApiEnvelope<KnowledgePage<KnowledgeDocument>>>(
        `${basePath(id)}/documents`,
        { ...options, params }
      )
      .then(unwrap)
      .catch(rejectRequest),
  document: (
    id: string,
    documentId: string,
    params: QueryParams = {},
    options: AxiosRequestConfig = {}
  ) =>
    apiClient
      .get<ApiEnvelope<DocumentDetail>>(documentPath(id, documentId), {
        ...options,
        params,
      })
      .then(unwrap)
      .catch(rejectRequest),
  preview: (id: string, data: ImportData, options: AxiosRequestConfig = {}) =>
    apiClient
      .post<ApiEnvelope<ImportPreview>>(
        `${basePath(id)}/preview`,
        data,
        importOptions(data, options)
      )
      .then(unwrap)
      .catch(rejectRequest),
  importDocument: (
    id: string,
    data: ImportData,
    options: AxiosRequestConfig = {}
  ) =>
    apiClient
      .post<ApiEnvelope<KnowledgeDocument>>(
        `${basePath(id)}/documents`,
        data,
        importOptions(data, options)
      )
      .then(unwrap)
      .catch(rejectRequest),
  updateDocument: (
    id: string,
    documentId: string,
    data: { enabled: boolean }
  ) =>
    apiClient
      .patch<ApiEnvelope<KnowledgeDocument>>(documentPath(id, documentId), data)
      .then(unwrap)
      .catch(rejectRequest),
  deleteDocument: (id: string, documentId: string) =>
    apiClient
      .delete<ApiEnvelope<unknown>>(documentPath(id, documentId))
      .then(unwrap)
      .catch(rejectRequest),
  rebuildDocument: (id: string, documentId: string) =>
    apiClient
      .post<ApiEnvelope<KnowledgeDocument>>(
        `${documentPath(id, documentId)}/rebuild`,
        {},
        { timeout: 180000 }
      )
      .then(unwrap)
      .catch(rejectRequest),
  rebuild: (id: string) =>
    apiClient
      .post<ApiEnvelope<{ succeeded: number; failed: number }>>(
        `${basePath(id)}/rebuild`,
        {},
        { timeout: 180000 }
      )
      .then(unwrap)
      .catch(rejectRequest),
  retrieve: (
    id: string,
    data: { query: string; topK: number; scoreThreshold: number },
    options: AxiosRequestConfig = {}
  ) =>
    apiClient
      .post<ApiEnvelope<RetrievalResult>>(`${basePath(id)}/retrieve`, data, {
        timeout: 60000,
        ...options,
      })
      .then(unwrap)
      .catch(rejectRequest),
};
export async function listKnowledgeBases(
  params: QueryParams = {},
  options: AxiosRequestConfig = {}
): Promise<KnowledgeBase[]> {
  const items: KnowledgeBase[] = [];
  let page = 1;
  let total = 0;
  do {
    const response = await knowledgeAPI.list(
      { ...params, page, pageSize: 100 },
      options
    );
    const batch = response.data?.items || [];
    items.push(...batch);
    total = response.data?.total || 0;
    if (!batch.length) break;
    page += 1;
  } while (items.length < total);
  return items;
}
