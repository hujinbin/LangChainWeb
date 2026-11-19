import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomAgentList from './CustomAgentList';
import { customAgentAPI } from '../../services/customAgentApi';
import { emptyAgent } from './CustomAgentShared';
import useAuthStore from '../../store/authStore';

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
