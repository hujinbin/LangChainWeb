import type { InternalAxiosRequestConfig } from 'axios';
import apiClient from './api';
import { agentAPI } from './agentApi';

jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));

const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200
) => ({
  config,
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Forbidden',
  headers: {},
});

beforeEach(() => localStorage.clear());
afterAll(() => {
  apiClient.defaults.adapter = originalAdapter;
});

test('素材请求仅将登录凭据发送到受鉴权的站内素材路径', async () => {
  localStorage.setItem('token', 'account-token');
  const requests: InternalAxiosRequestConfig[] = [];
  const blob = new Blob(['image'], { type: 'image/png' });
  apiClient.defaults.adapter = async (config) => {
    requests.push(config);
    return response(config, blob);
  };
  const url = `/api/aiAgents/projects/project-1/assets/${'a'.repeat(32)}.png`;
  const controller = new AbortController();
  expect(await agentAPI.asset(url, controller.signal)).toBe(blob);
  expect(requests[0].headers.token).toBe('account-token');
  expect(requests[0].headers.Authorization).toBe('account-token');
  expect(requests[0]).toMatchObject({
    url,
    responseType: 'blob',
    signal: controller.signal,
  });
  for (const address of [
    `https://example.com${url}`,
    `//example.com${url}`,
    `${url}?redirect=https://example.com`,
    '/api/user/profile',
    `/api/aiAgents/projects/../assets/${'a'.repeat(32)}.png`,
  ])
    await expect(agentAPI.asset(address)).rejects.toThrow('素材地址不正确');
  expect(requests).toHaveLength(1);
});

test('智能体业务失败保留服务端提示、错误类型和HTTP状态', async () => {
  apiClient.defaults.adapter = async (config) =>
    response(config, {
      code: 0,
      msg: '项目正在生成，请稍后修改',
      errorCode: 'PROJECT_BUSY',
    });
  await expect(agentAPI.design('project/1', '修改分镜')).rejects.toMatchObject({
    message: '项目正在生成，请稍后修改',
    code: 0,
    errorCode: 'PROJECT_BUSY',
    isBusinessError: true,
    response: { status: 200 },
  });
});

test('状态查询带取消信号，续跑与单镜头重生成保留独立语义', async () => {
  const requests: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = async (config) => {
    requests.push(config);
    return response(config, { code: 200, data: { id: 'project-1' } });
  };
  const controller = new AbortController();
  await agentAPI.status('project/1', controller.signal);
  await agentAPI.run('project-1');
  await agentAPI.run('project-1', { sceneId: 'scene-2', regenerate: true });
  expect(requests[0]).toMatchObject({
    url: '/api/aiAgents/projects/project%2F1/status',
    signal: controller.signal,
  });
  expect(JSON.parse(requests[1].data)).toEqual({});
  expect(JSON.parse(requests[2].data)).toEqual({
    sceneId: 'scene-2',
    regenerate: true,
  });
});

test('导出遇到200状态的JSON业务错误时拒绝下载', async () => {
  apiClient.defaults.adapter = async (config) =>
    response(
      config,
      new Blob(
        [
          JSON.stringify({
            code: 0,
            msg: '成片尚未完成',
            errorCode: 'OUTPUT_NOT_READY',
          }),
        ],
        { type: 'application/json' }
      )
    );
  await expect(agentAPI.export('project-1', 'zip')).rejects.toMatchObject({
    message: '成片尚未完成',
    errorCode: 'OUTPUT_NOT_READY',
    isBusinessError: true,
  });
});

test('导出HTTP失败时解码Blob错误并保留状态', async () => {
  apiClient.defaults.adapter = async (config) => {
    throw Object.assign(new Error('Request failed with status code 403'), {
      isAxiosError: true,
      response: response(
        config,
        new Blob([JSON.stringify({ code: 0, msg: '没有权限导出该项目' })], {
          type: 'application/json',
        }),
        403
      ),
    });
  };
  await expect(agentAPI.export('project-1', 'json')).rejects.toMatchObject({
    message: '没有权限导出该项目',
    response: { status: 403 },
  });
});

test('正常JSON导出和ZIP导出保留附件内容', async () => {
  const files = [
    new Blob([JSON.stringify({ id: 'project-1', draft: null })], {
      type: 'application/json',
    }),
    new Blob(['zip-content'], { type: 'application/zip' }),
  ];
  const requests: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = async (config) => {
    requests.push(config);
    return response(config, files[requests.length - 1]);
  };
  expect(await agentAPI.export('project-1', 'json')).toBe(files[0]);
  expect(await agentAPI.export('project-1', 'zip')).toBe(files[1]);
  expect(requests.map((item) => item.params.format)).toEqual(['json', 'zip']);
  expect(requests[0]).toMatchObject({ responseType: 'blob', timeout: 180000 });
});
