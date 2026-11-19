import type { InternalAxiosRequestConfig } from 'axios';
import apiClient from './api';
import { customAgentAPI } from './customAgentApi';
import { emptyAgent } from '../pages/CustomAgents/CustomAgentShared';

jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));
const originalAdapter = apiClient.defaults.adapter;
afterEach(() => { apiClient.defaults.adapter = originalAdapter; localStorage.clear(); });
test('自建智能体使用独立接口并携带登录凭证、取消信号和版本号', async () => {
  localStorage.setItem('token', 'test-token');
  const requests: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = config => { requests.push(config); return Promise.resolve({ data: { code: 200, data: {} }, status: 200, statusText: 'OK', headers: {}, config }); };
  const controller = new AbortController();
  await customAgentAPI.catalog(controller.signal);
  await customAgentAPI.update('agent / 1', { ...emptyAgent(), name: '助手', revision: 3 });
  expect(requests[0].url).toBe('/api/aiCustomAgents/catalog');
  expect(requests[0].signal).toBe(controller.signal);
  expect(requests[0].headers.token).toBe('test-token');
  expect(requests[1].url).toBe('/api/aiCustomAgents/agent%20%2F%201');
  expect(requests[1].method).toBe('patch');
  expect(JSON.parse(requests[1].data).revision).toBe(3);
});
test('业务版本冲突保留状态并拒绝，不伪造保存成功', async () => {
  apiClient.defaults.adapter = config => Promise.resolve({ data: { code: 409, msg: '配置已更新，请刷新' }, status: 200, statusText: 'OK', headers: {}, config });
  await expect(customAgentAPI.update('agent-1', { ...emptyAgent(), revision: 1 })).rejects.toMatchObject({ code: 409, message: '配置已更新，请刷新' });
});
