import { isAxiosError } from 'axios';
import { asRecord, normalizeError } from '../types/api';
import type { ApiError } from '../types/api';
import type { AxiosResponse } from 'axios';
import apiClient from './api';
import type {
  AgentCatalog,
  AgentExportFormat,
  AgentKind,
  AgentPage,
  AgentProject,
  AgentStatus,
  AgentUpdate,
} from '../types/agent';

interface Envelope<T> {
  code: number;
  data: T;
  msg?: string;
}

function businessError(payload: unknown, status?: number): ApiError {
  const data = asRecord(payload);
  const error: ApiError = new Error(
    typeof data.msg === 'string' ? data.msg : '智能体请求失败，请重试'
  );
  error.code =
    typeof data.code === 'number' || typeof data.code === 'string'
      ? data.code
      : undefined;
  error.errorCode =
    typeof data.errorCode === 'string' ? data.errorCode : undefined;
  error.data = asRecord(data.data);
  error.isBusinessError = true;
  if (status !== undefined)
    error.response = {
      status,
      data: {
        code: typeof data.code === 'number' ? data.code : 0,
        msg: error.message,
        data: error.data,
      },
    };
  return error;
}

function unwrap<T>(response: AxiosResponse<Envelope<T>>): T {
  if (response.data?.code !== 200)
    throw businessError(response.data, response.status);
  return response.data.data;
}

async function readBlobPayload(
  blob: Blob
): Promise<Record<string, unknown> | null> {
  try {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    const payload: unknown = JSON.parse(text);
    return asRecord(payload);
  } catch {
    return null;
  }
}

async function unwrapBlob(
  request: Promise<AxiosResponse<Blob>>
): Promise<Blob> {
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
      // 下载接口的错误响应也会被 Axios 包装成 Blob，需要还原服务端的业务提示。
      const payload = await readBlobPayload(cause.response.data);
      if (typeof payload?.msg === 'string')
        throw businessError(payload, cause.response.status);
    }
    throw normalizeError(cause);
  }
}

const path = (id: string): string =>
  `/api/aiAgents/projects/${encodeURIComponent(id)}`;

export const agentAPI = {
  catalog: (signal?: AbortSignal): Promise<AgentCatalog> =>
    apiClient
      .get<Envelope<AgentCatalog>>('/api/aiAgents/catalog', { signal })
      .then(unwrap),
  list: (page = 1, signal?: AbortSignal): Promise<AgentPage> =>
    apiClient
      .get<
        Envelope<AgentPage>
      >('/api/aiAgents/projects', { params: { page, pageSize: 20 }, signal })
      .then(unwrap),
  create: (agentId: AgentKind, name?: string): Promise<AgentProject> =>
    apiClient
      .post<Envelope<AgentProject>>('/api/aiAgents/projects', { agentId, name })
      .then(unwrap),
  get: (id: string, signal?: AbortSignal): Promise<AgentProject> =>
    apiClient.get<Envelope<AgentProject>>(path(id), { signal }).then(unwrap),
  update: (id: string, data: AgentUpdate): Promise<AgentProject> =>
    apiClient.patch<Envelope<AgentProject>>(path(id), data).then(unwrap),
  design: (
    id: string,
    message: string,
    signal?: AbortSignal
  ): Promise<AgentProject> =>
    apiClient
      .post<
        Envelope<AgentProject>
      >(`${path(id)}/design`, { message }, { signal, timeout: 210000 })
      .then(unwrap),
  run: (
    id: string,
    options: { sceneId?: string; regenerate?: boolean } = {}
  ): Promise<AgentProject> =>
    apiClient
      .post<Envelope<AgentProject>>(`${path(id)}/run`, options)
      .then(unwrap),
  cancel: (id: string): Promise<AgentProject> =>
    apiClient
      .post<Envelope<AgentProject>>(`${path(id)}/cancel`, {})
      .then(unwrap),
  status: (id: string, signal?: AbortSignal): Promise<AgentStatus> =>
    apiClient
      .get<Envelope<AgentStatus>>(`${path(id)}/status`, { signal })
      .then(unwrap),
  delete: (id: string): Promise<void> =>
    apiClient
      .delete<Envelope<unknown>>(path(id))
      .then(unwrap)
      .then(() => undefined),
  export: (id: string, format: AgentExportFormat): Promise<Blob> =>
    unwrapBlob(
      apiClient.get<Blob>(`${path(id)}/export`, {
        params: { format },
        responseType: 'blob',
        timeout: 180000,
      })
    ),
  asset: (url: string, signal?: AbortSignal): Promise<Blob> => {
    // 只有本站受鉴权的素材路径可以携带登录凭据，外部模型地址不能使用该请求器。
    if (
      !/^\/api\/aiAgents\/projects\/[A-Za-z0-9_-]+\/assets\/[a-f0-9]{32}\.(png|jpg|webp|mp4)$/.test(
        url
      )
    )
      return Promise.reject(new Error('素材地址不正确'));
    return unwrapBlob(
      apiClient.get<Blob>(url, {
        signal,
        responseType: 'blob',
        timeout: 120000,
      })
    );
  },
};

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace(/[<>:"/\\|?*]/g, '_');
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
