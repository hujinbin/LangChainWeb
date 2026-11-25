import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomAgentList from './CustomAgentList';
import { customAgentAPI } from '../../services/customAgentApi';
import { emptyAgent } from './CustomAgentShared';
import useAuthStore from '../../store/authStore';
import { aiWorkflowAPI } from '../../services/api';
import type { Workflow } from '../../types/workflow';

jest.mock('../../services/customAgentApi', () => ({ customAgentAPI: { list: jest.fn(), delete: jest.fn() } }));
const api = jest.mocked(customAgentAPI);
beforeEach(() => {
  jest.resetAllMocks(); useAuthStore.setState({ isLoggedIn: true, token: 'test', user: { id: 'user-1' } });
  api.list.mockResolvedValue({ items: [{ ...emptyAgent(), id: 'agent-1', name: '产品助手', status: 'draft', revision: 1 }], total: 1, page: 1, pageSize: 12 });
});
afterEach(() => { jest.restoreAllMocks(); useAuthStore.setState({ isLoggedIn: false, token: '', user: null }); });

test('我的智能体展示真实列表和独立创建入口', async () => {
  render(<MemoryRouter><CustomAgentList /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: /产品助手/ })).toHaveAttribute('href', '/agents/custom/agent-1');
  expect(screen.getByRole('link', { name: '创建智能体' })).toHaveAttribute('href', '/agents/custom/new');
});
test('删除需用户确认，成功后刷新真实列表', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true); api.delete.mockResolvedValue(undefined);
  render(<MemoryRouter><CustomAgentList /></MemoryRouter>);
  await screen.findByRole('link', { name: /产品助手/ });
  fireEvent.click(screen.getByRole('button', { name: '删除智能体产品助手' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('agent-1'));
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
});
test('列表失败不会伪造空成功，支持重试并过滤内部地址', async () => {
  api.list.mockRejectedValueOnce(new Error('https://internal.example.com ECONNRESET'));
  render(<MemoryRouter><CustomAgentList /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('操作暂时未完成');
  expect(screen.queryByText(/internal.example/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByRole('link', { name: /产品助手/ });
});

test('all pages are classified by actual linked nodes, including legacy nested workflows', async () => {
  const base = { ...emptyAgent(), status: 'published' as const, revision: 1 };
  const writer = { ...base, id: 'writer', name: '摄影与视频文案' };
  const artist = { ...base, id: 'artist', name: '旅行助手', workflowIds: ['parent'] };
  const declared = { ...base, id: 'declared', name: '电影工作室', outputType: 'video' as const };
  api.list.mockImplementation(async ({ page } = {}) => ({
    items: page === 1 ? [writer, declared] : [artist], page: Number(page), pageSize: 2, total: 3,
  }));
  const position = { x: 0, y: 0 };
  const parent: Workflow = { _id: 'parent', nodes: [{ id: 'sub', type: 'subWorkflow', position, parameters: { workflowId: 'child' } }] };
  const child: Workflow = { id: 'child', nodes: [
    { id: 'image', type: 'imageGeneration', position }, { id: 'clip', type: 'videoGeneration', position },
    { id: 'loop', type: 'subWorkflow', position, parameters: { workflowId: 'parent' } },
  ] };
  const graph = jest.spyOn(aiWorkflowAPI, 'list').mockImplementation(async ({ page } = {}) => ({
    code: 200, data: page === 1 ? [parent] : [child],
  }));
  const view = (category: 'text' | 'image' | 'video') => <MemoryRouter><CustomAgentList category={category} /></MemoryRouter>;
  const { rerender } = render(view('image'));
  expect(await screen.findByRole('heading', { name: artist.name })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: writer.name })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: declared.name })).not.toBeInTheDocument();
  rerender(view('video'));
  expect(screen.getByRole('heading', { name: artist.name })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: declared.name })).toBeInTheDocument();
  rerender(view('text'));
  expect(screen.getByRole('heading', { name: writer.name })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: artist.name })).not.toBeInTheDocument();
  expect(graph).toHaveBeenCalledTimes(2);
  expect(api.list).toHaveBeenCalledTimes(2);
});
