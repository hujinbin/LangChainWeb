import { isAxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import apiClient from './api';
import { asRecord, normalizeError } from '../types/api';
import type { ApiError } from '../types/api';
import { downloadBlob } from './agentApi';
import type {
  NovelCatalog,
  NovelCreateInput,
  NovelExportFormat,
  NovelPage,
  NovelProject,
} from '../types/novel';

interface Envelope<T> {
  code: number;
  data: T;
  msg?: string;
  errorCode?: string;
}

function businessError(payload: unknown, status?: number): ApiError {
  const data = asRecord(payload);
  const error: ApiError = new Error(
    typeof data.msg === 'string' ? data.msg : '小说创作请求失败，请重试'
  );
  error.code =
    typeof data.code === 'number' || typeof data.code === 'string'
      ? data.code
      : undefined;
  error.errorCode =
    typeof data.errorCode === 'string' ? data.errorCode : undefined;
  error.isBusinessError = true;
  if (status !== undefined)
    error.response = {
      status,
      data: {
        code: typeof data.code === 'number' ? data.code : 0,
        msg: error.message,
        data: asRecord(data.data),
      },
    };
  return error;
}

function unwrap<T>(response: AxiosResponse<Envelope<T>>): T {
  if (response.data?.code !== 200)
    throw businessError(response.data, response.status);
  return response.data.data;
}

async function readBlobPayload(blob: Blob): Promise<Record<string, unknown> | null> {
  try {
    const text = await blob.text();
    return asRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

async function unwrapBlob(request: Promise<AxiosResponse<Blob>>): Promise<Blob> {
  try {
    const response = await request;
    const contentType = String(
      response.headers['content-type'] || response.data.type
    ).toLowerCase();
    if (contentType.includes('json')) {
      const payload = await readBlobPayload(response.data);
      if (payload?.code !== undefined && payload.code !== 200)
        throw businessError(payload, response.status);
    }
    return response.data;
  } catch (cause: unknown) {
    if (isAxiosError<Blob>(cause) && cause.response?.data instanceof Blob) {
      const payload = await readBlobPayload(cause.response.data);
      if (typeof payload?.msg === 'string')
        throw businessError(payload, cause.response.status);
    }
    throw normalizeError(cause);
  }
}

const base = '/api/aiAgents/novel';
const path = (id: string): string => `${base}/projects/${encodeURIComponent(id)}`;

export const novelAPI = {
  catalog: (signal?: AbortSignal): Promise<NovelCatalog> =>
    apiClient.get<Envelope<NovelCatalog>>(`${base}/catalog`, { signal }).then(unwrap),
  list: (page = 1, signal?: AbortSignal): Promise<NovelPage> =>
    apiClient
      .get<Envelope<NovelPage>>(`${base}/projects`, {
        params: { page, pageSize: 20 },
        signal,
      })
      .then(unwrap),
  create: (input: NovelCreateInput): Promise<NovelProject> =>
    apiClient.post<Envelope<NovelProject>>(`${base}/projects`, input).then(unwrap),
  get: (id: string, signal?: AbortSignal): Promise<NovelProject> =>
    apiClient.get<Envelope<NovelProject>>(path(id), { signal }).then(unwrap),
  update: (id: string, data: Partial<NovelProject> & { revision?: number }): Promise<NovelProject> =>
    apiClient.patch<Envelope<NovelProject>>(path(id), data).then(unwrap),
  remove: (id: string): Promise<void> =>
    apiClient
      .delete<Envelope<unknown>>(path(id))
      .then(unwrap)
      .then(() => undefined),
  outline: (id: string, instruction?: string): Promise<NovelProject> =>
    apiClient
      .post<Envelope<NovelProject>>(`${path(id)}/outline`, { instruction })
      .then(unwrap),
  generateChapter: (
    id: string,
    chapterId: string,
    options: { instruction?: string; force?: boolean } = {}
  ): Promise<NovelProject> =>
    apiClient
      .post<Envelope<NovelProject>>(
        `${path(id)}/chapters/${encodeURIComponent(chapterId)}/generate`,
        options
      )
      .then(unwrap),
  updateChapter: (
    id: string,
    chapterId: string,
    data: { title?: string; summary?: string; content?: string }
  ): Promise<NovelProject> =>
    apiClient
      .patch<Envelope<NovelProject>>(
        `${path(id)}/chapters/${encodeURIComponent(chapterId)}`,
        data
      )
      .then(unwrap),
  cancel: (id: string): Promise<{ cancelled: boolean }> =>
    apiClient.post<Envelope<{ cancelled: boolean }>>(`${path(id)}/cancel`, {}).then(unwrap),
  export: async (id: string, format: NovelExportFormat, fileName: string): Promise<void> => {
    const blob = await unwrapBlob(
      apiClient.get<Blob>(`${path(id)}/export`, {
        params: { format },
        responseType: 'blob',
        timeout: 180000,
      })
    );
    downloadBlob(blob, `${fileName}.${format}`);
  },
};
