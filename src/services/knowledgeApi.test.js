import apiClient from './api';
import { knowledgeAPI, listKnowledgeBases } from './knowledgeApi';

jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));
const originalAdapter = apiClient.defaults.adapter;
const respond = (config, data) =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });
afterAll(() => {
  apiClient.defaults.adapter = originalAdapter;
});
beforeEach(() => localStorage.clear());

test('知识库REST请求沿用账号鉴权，文本导入和检索保留真实参数', async () => {
  const requests = [];
  localStorage.setItem('token', 'account-token');
  apiClient.defaults.adapter = (config) => {
    requests.push(config);
    return respond(config, { code: 200, data: { id: 'base-1' } });
  };
  await knowledgeAPI.update('base-1', { enabled: false });
  await knowledgeAPI.preview('base-1', {
    name: '说明',
    text: '真实文本',
    chunkSize: 800,
    chunkOverlap: 100,
  });
  await knowledgeAPI.retrieve('base-1', {
    query: '文件格式',
    topK: 5,
    scoreThreshold: 3.5,
  });
  expect(requests[0].method).toBe('patch');
  expect(requests[0].headers.token).toBe('account-token');
  expect(requests[1].url).toBe('/api/aiKnowledge/bases/base-1/preview');
  expect(JSON.parse(requests[1].data).text).toBe('真实文本');
  expect(JSON.parse(requests[2].data).scoreThreshold).toBe(3.5);
});

test('文件预览传递FormData，不能把业务失败当作成功导入', async () => {
  const data = new FormData();
  data.append(
    'file',
    new File(['文档内容'], 'document.txt', { type: 'text/plain' }),
  );
  let request;
  apiClient.defaults.adapter = (config) => {
    request = config;
    return respond(config, {
      code: 503,
      msg: '文档索引失败',
      data: { document: { status: 'failed' } },
    });
  };
  await expect(
    knowledgeAPI.importDocument('base-1', data),
  ).rejects.toMatchObject({
    message: '文档索引失败',
    data: { document: { status: 'failed' } },
  });
  expect(request.data).toBe(data);
  expect(request.headers['Content-Type']).not.toContain('application/json');
});

test('工作流知识库选项翻页读取，包含第一百个以后的库', async () => {
  const pages = [];
  apiClient.defaults.adapter = (config) => {
    pages.push(config.params.page);
    const start = (config.params.page - 1) * 100;
    const items = Array.from({ length: start === 0 ? 100 : 1 }, (_, index) => ({
      id: `base-${start + index + 1}`,
    }));
    return respond(config, {
      code: 200,
      data: { items, total: 101, page: config.params.page, pageSize: 100 },
    });
  };
  const items = await listKnowledgeBases();
  expect(pages).toEqual([1, 2]);
  expect(items).toHaveLength(101);
  expect(items[100].id).toBe('base-101');
});
