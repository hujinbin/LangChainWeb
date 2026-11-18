import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowList from './WorkflowList';
import { workflowDefAPI } from '../../services/api';
import type { ApiEnvelope } from '../../types/api';
import type { Workflow } from '../../types/workflow';

const mockWorkflowDefAPI = workflowDefAPI as jest.Mocked<typeof workflowDefAPI>;

jest.mock('../../services/api', () => ({
  workflowDefAPI: {
    getWorkflows: jest.fn(),
    deleteWorkflow: jest.fn(),
    toggleWorkflow: jest.fn(),
  },
}));
jest.mock(
  '../../store/authStore',
  () => (selector: (state: { isLoggedIn: boolean }) => unknown) => selector({ isLoggedIn: true })
);
jest.mock('../../services/localStorage', () => ({
  getWorkflows: () => [],
  deleteWorkflow: jest.fn(),
}));

const workflow = (id: string, name: string, status = 'draft'): Workflow => ({
  id,
  name,
  status,
  isLocal: false,
  nodes: [],
  edges: [],
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};
const renderList = () =>
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <WorkflowList />
    </MemoryRouter>
  );
const loadDebounced = () =>
  act(async () => {
    jest.advanceTimersByTime(250);
  });

beforeEach(() => {
  jest.useFakeTimers();
  mockWorkflowDefAPI.getWorkflows.mockReset();
  mockWorkflowDefAPI.deleteWorkflow.mockReset();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('较早请求晚返回时保留最新筛选结果', async () => {
  const earlier = deferred<ApiEnvelope<Workflow[]>>();
  const latest = deferred<ApiEnvelope<Workflow[]>>();
  mockWorkflowDefAPI.getWorkflows
    .mockReturnValueOnce(earlier.promise)
    .mockReturnValueOnce(latest.promise);
  renderList();
  await loadDebounced();
  expect(mockWorkflowDefAPI.getWorkflows).toHaveBeenNthCalledWith(1, { page: 1 });
  fireEvent.click(screen.getByRole('button', { name: '已发布' }));
  await loadDebounced();
  expect(mockWorkflowDefAPI.getWorkflows).toHaveBeenNthCalledWith(2, {
    page: 1,
    status: 'published',
  });
  await act(async () => {
    latest.resolve({ code: 200, data: [workflow('new', '最新发布流程', 'published')] });
  });
  expect(
    screen.getByRole('link', { name: /最新发布流程/ })
  ).toBeInTheDocument();
  await act(async () => {
    earlier.resolve({ code: 200, data: [workflow('old', '较早响应流程', 'published')] });
  });
  expect(
    screen.getByRole('link', { name: /最新发布流程/ })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: /较早响应流程/ })
  ).not.toBeInTheDocument();
});

test('删除服务端记录后刷新补齐当前页，删除失败保留记录并显示原因', async () => {
  const firstPage = Array.from({ length: 20 }, (_, index) =>
    workflow(`flow-${index + 1}`, `流程 ${index + 1}`)
  );
  const refill = [...firstPage.slice(1), workflow('flow-21', '补入页尾的流程')];
  mockWorkflowDefAPI.getWorkflows
    .mockResolvedValueOnce({ code: 200, data: firstPage })
    .mockResolvedValueOnce({ code: 200, data: refill });
  mockWorkflowDefAPI.deleteWorkflow
    .mockResolvedValueOnce({ code: 200, data: undefined })
    .mockRejectedValueOnce(new Error('无权限删除'));
  renderList();
  await loadDebounced();
  expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '删除 流程 1' }));
  expect(
    await screen.findByRole('link', { name: /补入页尾的流程/ })
  ).toBeInTheDocument();
  expect(mockWorkflowDefAPI.deleteWorkflow).toHaveBeenNthCalledWith(1, 'flow-1');
  expect(mockWorkflowDefAPI.getWorkflows).toHaveBeenCalledTimes(2);
  expect(mockWorkflowDefAPI.getWorkflows).toHaveBeenLastCalledWith({ page: 1 });
  expect(
    screen.queryByRole('button', { name: '删除 流程 1' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '删除 流程 2' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('无权限删除');
  expect(mockWorkflowDefAPI.deleteWorkflow).toHaveBeenNthCalledWith(2, 'flow-2');
  expect(
    screen.getByRole('button', { name: '删除 流程 2' })
  ).toBeInTheDocument();
  expect(mockWorkflowDefAPI.getWorkflows).toHaveBeenCalledTimes(2);
});
