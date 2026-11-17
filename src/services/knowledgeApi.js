import apiClient from './api';

const ROOT = '/api/aiKnowledge';
const basePath = (id) => `${ROOT}/bases/${encodeURIComponent(id)}`;
const documentPath = (id, documentId) =>
  `${basePath(id)}/documents/${encodeURIComponent(documentId)}`;

function unwrap(response) {
  const payload = response.data;
  if (!payload || payload.code !== 200) {
    const error = new Error(payload?.msg || '知识库请求失败，请稍后重试');
    error.code = payload?.code;
    error.isBusinessError = true;
    error.data = payload?.data;
    throw error;
  }
  return payload;
}

function rejectRequest(error) {
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

function importOptions(data, options) {
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
  config: (options = {}) =>
    apiClient.get(`${ROOT}/config`, options).then(unwrap).catch(rejectRequest),
  list: (params = {}, options = {}) =>
    apiClient
      .get(`${ROOT}/bases`, { ...options, params })
      .then(unwrap)
      .catch(rejectRequest),
  create: (data) =>
    apiClient.post(`${ROOT}/bases`, data).then(unwrap).catch(rejectRequest),
  detail: (id, options = {}) =>
    apiClient.get(basePath(id), options).then(unwrap).catch(rejectRequest),
  update: (id, data) =>
    apiClient.patch(basePath(id), data).then(unwrap).catch(rejectRequest),
  delete: (id) =>
    apiClient.delete(basePath(id)).then(unwrap).catch(rejectRequest),
  documents: (id, params = {}, options = {}) =>
    apiClient
      .get(`${basePath(id)}/documents`, { ...options, params })
      .then(unwrap)
      .catch(rejectRequest),
  document: (id, documentId, params = {}, options = {}) =>
    apiClient
      .get(documentPath(id, documentId), { ...options, params })
      .then(unwrap)
      .catch(rejectRequest),
  preview: (id, data, options = {}) =>
    apiClient
      .post(`${basePath(id)}/preview`, data, importOptions(data, options))
      .then(unwrap)
      .catch(rejectRequest),
  importDocument: (id, data, options = {}) =>
    apiClient
      .post(`${basePath(id)}/documents`, data, importOptions(data, options))
      .then(unwrap)
      .catch(rejectRequest),
  updateDocument: (id, documentId, data) =>
    apiClient
      .patch(documentPath(id, documentId), data)
      .then(unwrap)
      .catch(rejectRequest),
  deleteDocument: (id, documentId) =>
    apiClient
      .delete(documentPath(id, documentId))
      .then(unwrap)
      .catch(rejectRequest),
  rebuildDocument: (id, documentId) =>
    apiClient
      .post(`${documentPath(id, documentId)}/rebuild`, {}, { timeout: 180000 })
      .then(unwrap)
      .catch(rejectRequest),
  rebuild: (id) =>
    apiClient
      .post(`${basePath(id)}/rebuild`, {}, { timeout: 180000 })
      .then(unwrap)
      .catch(rejectRequest),
  retrieve: (id, data, options = {}) =>
    apiClient
      .post(`${basePath(id)}/retrieve`, data, { timeout: 60000, ...options })
      .then(unwrap)
      .catch(rejectRequest),
};

export async function listKnowledgeBases(params = {}, options = {}) {
  const items = [];
  let page = 1;
  let total = 0;
  do {
    const response = await knowledgeAPI.list(
      { ...params, page, pageSize: 100 },
      options,
    );
    const batch = response.data?.items || [];
    items.push(...batch);
    total = response.data?.total || 0;
    if (!batch.length) break;
    page += 1;
  } while (items.length < total);
  return items;
}
