import type { Workflow } from '../types/workflow';
import localStorageService from './localStorage';

beforeEach(() => localStorage.clear());

test('本地保存返回完整草稿并标记来源，保持传入对象独立', () => {
  const original: Workflow = { name: '草稿', nodes: [], edges: [] };
  const saved = localStorageService.saveWorkflow(original);
  expect(saved).toMatchObject({
    name: '草稿',
    _source: 'local',
    isLocal: true,
  });
  expect(saved.id).toBeTruthy();
  expect(original.id).toBeUndefined();
  const updated = localStorageService.saveWorkflow({
    id: saved.id,
    name: '新名称',
  });
  expect(updated.created_at).toBe(saved.created_at);
  expect(localStorageService.getWorkflow(saved.id!)).toMatchObject({
    name: '新名称',
    isLocal: true,
  });
});

test('损坏存储安全回退，旧本地记录补全来源和模拟标记', () => {
  localStorage.setItem('local_workflows', '{}');
  expect(localStorageService.getWorkflows()).toEqual([]);
  localStorage.setItem('local_executions', JSON.stringify([{ id: 'old' }]));
  expect(localStorageService.getExecutions()[0]).toMatchObject({
    simulated: true,
    isLocal: true,
  });
});
