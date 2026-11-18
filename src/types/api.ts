import type { AxiosResponse } from 'axios';
import type { KnowledgeDocument } from './knowledge';
import type { Execution } from './workflow';

export interface ApiEnvelope<T> {
  code: number;
  msg?: string;
  data: T;
}

export interface ErrorData extends Partial<Execution> {
  [key: string]: unknown;
  error?: string;
  executionId?: string;
  document?: KnowledgeDocument;
}

export interface ApiError extends Error {
  code?: string | number;
  isBusinessError?: boolean;
  errorCode?: string;
  data?: ErrorData;
  execution?: Execution;
  response?: Pick<AxiosResponse<ApiEnvelope<ErrorData>>, 'status' | 'data'>;
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function normalizeError(value: unknown): ApiError {
  if (value instanceof Error) return value as ApiError;
  const record = asRecord(value);
  const message =
    typeof record.message === 'string'
      ? record.message
      : '操作失败，请稍后重试';
  return Object.assign(new Error(message), record, { message });
}
