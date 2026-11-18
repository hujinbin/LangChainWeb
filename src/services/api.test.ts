import type { InternalAxiosRequestConfig } from 'axios';
import type { GenerateWorkflowRequest } from '../types/workflow';
import apiClient, {
  aiWorkflowAPI,
  workflowAPI,
  mediaAPI,
  nodeAPI,
} from './api';

// CRA 的 Jest 版本使用 Axios 的浏览器 CJS 发行版，保留真实适配器与拦截器行为。
jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));

const originalAdapter = apiClient.defaults.adapter;
const mockResponse = (config: InternalAxiosRequestConfig, data: unknown) =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });

beforeEach(() => localStorage.clear());
afterAll(() => {
  apiClient.defaults.adapter = originalAdapter;
});

test('业务失败会拒绝保存和发布，保留服务端错误', async () => {
  apiClient.defaults.adapter = (config) =>
    mockResponse(config, { code: 0, msg: '没有权限' });
  await expect(aiWorkflowAPI.create({ name: 'test' })).rejects.toMatchObject({
    message: '没有权限',
    isBusinessError: true,
  });
  await expect(
    aiWorkflowAPI.update('workflow-1', { status: 'published' })
  ).rejects.toMatchObject({ code: 0 });
});

test('运行显式传布尔模拟开关、对象输入和取消信号，等待预算涵盖终态回包', async () => {
  const requests: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = (config) => {
    requests.push(config);
    return mockResponse(config, {
      code: 200,
      data: { executionId: 'execution-1', simulated: false, status: 'success' },
    });
  };
  const controller = new AbortController();
  await aiWorkflowAPI.run(
    'workflow-1',
    { question: '产品' },
    { timeoutMs: 600000, simulate: false, signal: controller.signal }
  );
  expect(JSON.parse(requests[0].data)).toEqual({
    id: 'workflow-1',
    input: { question: '产品' },
    simulate: false,
    triggerType: 'manual',
  });
  expect(requests[0].timeout).toBe(630000);
  expect(requests[0].signal).toBe(controller.signal);
  await aiWorkflowAPI.run('workflow-1', {}, { simulate: true });
  expect(JSON.parse(requests[1].data).simulate).toBe(true);
  await expect(
    aiWorkflowAPI.run('workflow-1', {}, {
      simulate: 'false',
    } as unknown as Parameters<typeof aiWorkflowAPI.run>[2])
  ).rejects.toThrow('布尔值');
  await expect(
    aiWorkflowAPI.run(
      'workflow-1',
      [] as unknown as Parameters<typeof aiWorkflowAPI.run>[1]
    )
  ).rejects.toThrow('对象');
  await expect(
    aiWorkflowAPI.update('workflow-1', { settings: { timeoutMs: 999 } })
  ).rejects.toThrow('timeoutMs');
  expect(requests).toHaveLength(2);
});

test('失败运行抛错时保留完整执行记录，旧模拟记录维持兼容', async () => {
  apiClient.defaults.adapter = (config) =>
    mockResponse(config, {
      code: 0,
      msg: '运行失败',
      data: {
        executionId: 'failed-execution',
        status: 'failed',
        error: '图片失败',
        nodeResults: [{ nodeId: 'image' }],
      },
    });
  await expect(aiWorkflowAPI.run('workflow-1')).rejects.toMatchObject({
    data: { id: 'failed-execution' },
    execution: { nodeResults: [{ nodeId: 'image' }] },
    response: { data: { code: 0 } },
    message: '图片失败',
  });
  apiClient.defaults.adapter = (config) =>
    mockResponse(config, {
      code: 200,
      data: { _id: 'older', status: 'success' },
    });
  const record = await workflowAPI.getRecordDetail('older');
  expect(record.simulated).toBe(true);
});

test('执行详情使用单条接口，视频查询保留上游数据结构', async () => {
  const requests: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = (config) => {
    requests.push(config);
    return mockResponse(config, {
      code: 200,
      data: config.url?.includes('ai/videos')
        ? { status: 'completed', url: 'https://example.com/video.mp4' }
        : { _id: 'execution-2' },
    });
  };
  await workflowAPI.getRecordDetail('execution-2');
  expect(requests[0].url).toBe('/api/aiWorkflow/execution');
  expect(requests[0].params).toEqual({ id: 'execution-2' });
  expect(await mediaAPI.queryVideo('video-1')).toEqual({
    status: 'completed',
    url: 'https://example.com/video.mp4',
  });
  expect(requests[1].params).toEqual({ video_id: 'video-1' });
});

test('节点表单使用模型目录交集，并保留服务器来源', async () => {
  apiClient.defaults.adapter = (config) => {
    const data = config.url?.endsWith('/models')
      ? { text: ['agnes-2.5-flash', 'agnes-3.0-pro'] }
      : config.url?.endsWith('/nodeTypes')
        ? [{ type: 'llm', models: ['agnes-3.0-flash', 'agnes-2.5-flash'] }]
        : { _id: 'workflow-1', name: '远程流程' };
    return mockResponse(config, { code: 200, data });
  };
  const schema = await nodeAPI.getNodeSchema('llm');
  expect(schema.data!.properties.model.enum).toEqual(['agnes-2.5-flash']);
  expect((await aiWorkflowAPI.detail('workflow-1')).data).toMatchObject({
    id: 'workflow-1',
    _source: 'server',
    isLocal: false,
  });
});

test('对话生成传递历史、当前画布与信号，并在调用前拒绝收费模型', async () => {
  const requests: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = (config) => {
    requests.push(config);
    return mockResponse(config, {
      code: 200,
      data: { reply: '请补充主题', workflow: null },
    });
  };
  const controller = new AbortController();
  const payload: GenerateWorkflowRequest = {
    message: '生成一个配图流程',
    messages: [{ role: 'user', content: '帮助我编排' }],
    workflow: { nodes: [], edges: [], input: { theme: '咖啡' } },
    model: 'agnes-3.0-flash',
    search: false,
  };
  await aiWorkflowAPI.generateWorkflow(payload, { signal: controller.signal });
  expect(requests[0].url).toBe('/api/aiWorkflow/generate');
  expect(requests[0].timeout).toBe(210000);
  expect(requests[0].signal).toBe(controller.signal);
  expect(JSON.parse(requests[0].data)).toEqual(payload);
  await expect(
    aiWorkflowAPI.generateWorkflow({ ...payload, model: 'agnes-3.0-pro' })
  ).rejects.toThrow('Flash');
  await expect(
    aiWorkflowAPI.generateWorkflow({
      ...payload,
      search: 'false',
    } as unknown as Parameters<typeof aiWorkflowAPI.generateWorkflow>[0])
  ).rejects.toThrow('布尔值');
  expect(requests).toHaveLength(1);
});
