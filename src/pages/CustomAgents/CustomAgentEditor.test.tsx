import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CustomAgentEditor from './CustomAgentEditor';
import { emptyAgent } from './CustomAgentShared';
import { customAgentAPI } from '../../services/customAgentApi';
import useAuthStore from '../../store/authStore';
import type { CustomAgent } from '../../types/customAgent';

jest.mock('../../services/customAgentApi', () => ({ customAgentAPI: { catalog: jest.fn(), create: jest.fn(), detail: jest.fn(), update: jest.fn(), publish: jest.fn(), unpublish: jest.fn(), chat: jest.fn(), conversation: jest.fn(), clearConversation: jest.fn(), memory: jest.fn(), clearMemory: jest.fn() } }));
const api = jest.mocked(customAgentAPI);
const saved: CustomAgent = { ...emptyAgent(), id: 'agent-1', revision: 1, name: '知识助手', systemPrompt: '先查知识再回答。', modelSettings: { model: 'agnes-3.0-flash', temperature: 0.6, maxTokens: 2048, search: false }, status: 'draft' };
const catalog = { models: ['agnes-3.0-flash'], tools: [{ id: 'current_time', name: '当前时间', description: '读取时间' }], workflows: [{ id: 'flow-1', name: '产品文案' }], knowledgeBases: [{ id: 'kb-1', name: '产品资料' }], limits: {} };
const renderEditor = (path = '/agents/custom/new') => render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/agents/custom/:id" element={<CustomAgentEditor />} /><Route path="/agents" element={<p>智能体列表</p>} /></Routes></MemoryRouter>);
beforeEach(() => {
  jest.resetAllMocks(); sessionStorage.clear();
  useAuthStore.setState({ isLoggedIn: true, token: 'test', user: { id: 'user-1' } });
  api.catalog.mockResolvedValue(catalog); api.detail.mockResolvedValue(saved); api.memory.mockResolvedValue({ items: [] });
  api.create.mockImplementation(async config => ({ ...config, id: 'agent-1', revision: 1, status: 'draft' }));
  api.update.mockImplementation(async (id, config) => ({ ...config, id, revision: config.revision + 1, status: 'draft' }));
  api.publish.mockResolvedValue({ ...saved, revision: 3, status: 'published' });
  api.unpublish.mockResolvedValue({ ...saved, revision: 4, status: 'draft' });
  api.chat.mockResolvedValue({ conversationId: 'conversation-1', reply: '已经查到产品资料。', messages: [{ role: 'user', content: '产品有哪些？' }, { role: 'assistant', content: '已经查到产品资料。' }], trace: [{ type: 'workflow', name: '产品文案', status: 'success', executionId: 'execution-1' }] });
  HTMLElement.prototype.scrollTo = jest.fn();
});
afterEach(() => useAuthStore.setState({ isLoggedIn: false, token: '', user: null }));

test('先保存配置再调试，关联资源保留且使用服务端回复和调用记录', async () => {
  renderEditor(); await screen.findByLabelText('智能体名称');
  fireEvent.change(screen.getByLabelText('智能体名称'), { target: { value: '资料助手' } });
  fireEvent.change(screen.getByLabelText('人设与回复逻辑'), { target: { value: '先查资料再回答' } });
  fireEvent.click(screen.getByLabelText('当前时间读取时间'));
  fireEvent.click(screen.getByLabelText('产品文案')); fireEvent.click(screen.getByLabelText('产品资料'));
  fireEvent.change(screen.getByLabelText('调试消息'), { target: { value: '产品有哪些？' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await screen.findByText('已经查到产品资料。');
  expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: '资料助手', workflowIds: ['flow-1'], knowledgeBaseIds: ['kb-1'], toolIds: ['current_time'] }));
  expect(api.chat).toHaveBeenCalledWith('agent-1', expect.objectContaining({ message: '产品有哪些？', revision: 1, mode: 'draft' }), expect.any(AbortSignal));
  expect(api.create.mock.invocationCallOrder[0]).toBeLessThan(api.chat.mock.invocationCallOrder[0]);
  expect(screen.getByRole('link', { name: '查看工作流记录' })).toHaveAttribute('href', '/executions/execution-1');
  expect(sessionStorage.getItem('custom-agent-conversation:user-1:agent-1')).toBe('conversation-1');
});

test('发布前保存最新版本，发布后可取消', async () => {
  renderEditor('/agents/custom/agent-1'); await screen.findByDisplayValue('知识助手');
  fireEvent.click(screen.getByRole('button', { name: '发布' }));
  await screen.findByRole('button', { name: '取消发布' });
  expect(api.publish).toHaveBeenCalledWith('agent-1', 2);
  fireEvent.click(screen.getByRole('button', { name: '取消发布' }));
  await waitFor(() => expect(api.unpublish).toHaveBeenCalledWith('agent-1', 3));
  await screen.findByText('已取消发布，当前编辑内容继续保留');
});

test('版本冲突保留当前编辑内容，且不会假称保存成功', async () => {
  api.update.mockRejectedValue(Object.assign(new Error('冲突'), { code: 409 }));
  renderEditor('/agents/custom/agent-1'); await screen.findByDisplayValue('知识助手');
  fireEvent.change(screen.getByLabelText('智能体名称'), { target: { value: '未保存的新名字' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('已在其他页面更新');
  expect(screen.getByLabelText('智能体名称')).toHaveValue('未保存的新名字');
  expect(screen.queryByText('草稿已保存')).not.toBeInTheDocument();
});

test('恢复服务端会话，清空对话后新轮不携带旧会话', async () => {
  sessionStorage.setItem('custom-agent-conversation:user-1:agent-1', 'previous');
  api.conversation.mockResolvedValue({ conversationId: 'previous', messages: [{ role: 'assistant', content: '上次对话' }] });
  renderEditor('/agents/custom/agent-1'); await screen.findByText('上次对话');
  fireEvent.click(screen.getByRole('button', { name: '清空调试对话' }));
  await waitFor(() => expect(api.clearConversation).toHaveBeenCalledWith('agent-1', 'previous'));
  await waitFor(() => expect(screen.queryByText('上次对话')).not.toBeInTheDocument());
  expect(sessionStorage.getItem('custom-agent-conversation:user-1:agent-1')).toBeNull();
});

test('停止按钮终止当前请求并保留明确反馈', async () => {
  api.chat.mockImplementation((id, data, signal) => new Promise((resolve, reject) => {
    signal?.addEventListener('abort', () => reject(Object.assign(new Error('取消'), { code: 'ERR_CANCELED' })));
  }));
  renderEditor('/agents/custom/agent-1'); await screen.findByDisplayValue('知识助手');
  fireEvent.change(screen.getByLabelText('调试消息'), { target: { value: '稍后停止' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(api.chat).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '停止' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('已停止等待回复');
  expect(api.chat.mock.calls[0][2]?.aborted).toBe(true);
});

test('失败回复保留新会话、已扣费用和已执行调用，恢复用户消息且不自动重试', async () => {
  const billing = { pointsCharged: 1.25, inputTokens: 1000, outputTokens: 250, totalTokens: 1250, billableTokens: 1250, imageCount: 0, estimated: false, status: 'settled', ruleVersion: 'v1' };
  api.chat.mockRejectedValue(Object.assign(new Error('工具执行未完成'), { response: { status: 422, data: { code: 422, data: { conversationId: 'failed-conversation', billing, trace: [{ type: 'workflow', name: '已完成的资料整理', status: 'success', executionId: 'finished-execution' }, { type: 'tool', name: '外部工具', status: 'failed', error: '工具未完成' }] } } } }));
  api.conversation.mockResolvedValue({ conversationId: 'failed-conversation', messages: [{ role: 'user', content: '保留这次输入' }] });
  renderEditor(); await screen.findByLabelText('智能体名称');
  fireEvent.change(screen.getByLabelText('智能体名称'), { target: { value: '资料助手' } });
  fireEvent.change(screen.getByLabelText('人设与回复逻辑'), { target: { value: '先查资料再回答' } });
  fireEvent.change(screen.getByLabelText('调试消息'), { target: { value: '保留这次输入' } });
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('再次发送会开始新一轮调用');
  expect(api.conversation).toHaveBeenCalledWith('agent-1', 'failed-conversation', expect.any(AbortSignal));
  expect(sessionStorage.getItem('custom-agent-conversation:user-1:agent-1')).toBe('failed-conversation');
  expect(screen.getByLabelText('调试消息')).toHaveValue('保留这次输入');
  expect(screen.getByRole('log', { name: '智能体调试对话' })).toHaveTextContent('保留这次输入');
  fireEvent.click(screen.getByText('本轮消耗与调用记录'));
  expect(screen.getByText('1.25')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '查看工作流记录' })).toHaveAttribute('href', '/executions/finished-execution');
  expect(api.chat).toHaveBeenCalledTimes(1);
});

test('已发布草稿的更新状态和额度长度限制与后端一致', async () => {
  api.detail.mockResolvedValue({ ...saved, status: 'published', hasUnpublishedChanges: true, publishedRevision: 1 });
  renderEditor('/agents/custom/agent-1'); await screen.findByDisplayValue('知识助手');
  expect(screen.getByText(/草稿有更新，待发布/)).toBeInTheDocument();
  expect(screen.getByLabelText('人设与回复逻辑')).toHaveAttribute('maxlength', '20000');
  expect(screen.getByLabelText('模型输出额度')).toHaveAttribute('min', '128');
  fireEvent.change(screen.getByLabelText('模型输出额度'), { target: { value: '127' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('128 至 8192');
  expect(api.update).not.toHaveBeenCalled();
});
