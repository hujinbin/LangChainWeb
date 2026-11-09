import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowList from './WorkflowList';
import { workflowDefAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  workflowDefAPI: {
    getWorkflows: jest.fn(),
    deleteWorkflow: jest.fn(),
    toggleWorkflow: jest.fn(),
  },
}));
jest.mock(
  '../../store/authStore',
  () => (selector) => selector({ isLoggedIn: true })
);
jest.mock('../../services/localStorage', () => ({
  getWorkflows: () => [],
  deleteWorkflow: jest.fn(),
}));

const workflow = (id, name, status = 'draft') => ({
  id,
  name,
  status,
  isLocal: false,
  nodes: [],
  edges: [],
});
const deferred = () => {
  let resolve;
  const promise = new Promise((complete) => {
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
  workflowDefAPI.getWorkflows.mockReset();
  workflowDefAPI.deleteWorkflow.mockReset();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('较早请求晚返回时保留最新筛选结果', async () => {
  const earlier = deferred();
  const latest = deferred();
  workflowDefAPI.getWorkflows
    .mockReturnValueOnce(earlier.promise)
    .mockReturnValueOnce(latest.promise);
  renderList();
  await loadDebounced();
  expect(workflowDefAPI.getWorkflows).toHaveBeenNthCalledWith(1, { page: 1 });
  fireEvent.click(screen.getByRole('button', { name: '已发布' }));
  await loadDebounced();
  expect(workflowDefAPI.getWorkflows).toHaveBeenNthCalledWith(2, {
    page: 1,
    status: 'published',
  });
  await act(async () => {
    latest.resolve({ data: [workflow('new', '最新发布流程', 'published')] });
  });
  expect(
    screen.getByRole('link', { name: /最新发布流程/ })
  ).toBeInTheDocument();
  await act(async () => {
    earlier.resolve({ data: [workflow('old', '较早响应流程', 'published')] });
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
  workflowDefAPI.getWorkflows
    .mockResolvedValueOnce({ data: firstPage })
    .mockResolvedValueOnce({ data: refill });
  workflowDefAPI.deleteWorkflow
    .mockResolvedValueOnce({ code: 200 })
    .mockRejectedValueOnce(new Error('无权限删除'));
  renderList();
  await loadDebounced();
  expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '删除 流程 1' }));
  expect(
    await screen.findByRole('link', { name: /补入页尾的流程/ })
  ).toBeInTheDocument();
  expect(workflowDefAPI.deleteWorkflow).toHaveBeenNthCalledWith(1, 'flow-1');
  expect(workflowDefAPI.getWorkflows).toHaveBeenCalledTimes(2);
  expect(workflowDefAPI.getWorkflows).toHaveBeenLastCalledWith({ page: 1 });
  expect(
    screen.queryByRole('button', { name: '删除 流程 1' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '删除 流程 2' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('无权限删除');
  expect(workflowDefAPI.deleteWorkflow).toHaveBeenNthCalledWith(2, 'flow-2');
  expect(
    screen.getByRole('button', { name: '删除 流程 2' })
  ).toBeInTheDocument();
  expect(workflowDefAPI.getWorkflows).toHaveBeenCalledTimes(2);
});
