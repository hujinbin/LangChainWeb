import React, { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowAssistant from './WorkflowAssistant';
import { aiWorkflowAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  aiWorkflowAPI: { getModels: jest.fn(), generateWorkflow: jest.fn() },
}));

const result = {
  reply: '已创建文本生成与输出节点。',
  workflow: {
    name: '创作流程',
    nodes: [{ id: 'text', type: 'llm' }],
    edges: [],
  },
  input: { question: '咖啡店文案' },
  warnings: [],
};
const baseProps = () => ({
  open: true,
  getWorkflow: jest.fn(() => ({
    name: '当前画布',
    nodes: [],
    edges: [],
    input: { question: '咖啡' },
  })),
  getRevision: jest.fn(() => 'revision-1'),
  onApply: jest.fn(),
  onClose: jest.fn(),
});
const renderAssistant = (props) =>
  render(
    <MemoryRouter>
      <WorkflowAssistant {...props} />
    </MemoryRouter>
  );
const sendMessage = (message) => {
  fireEvent.change(
    screen.getByRole('textbox', { name: /工作流需求|继续描述修改要求/ }),
    { target: { value: message } }
  );
  fireEvent.click(screen.getByRole('button', { name: '生成工作流' }));
};

beforeEach(() => {
  jest.clearAllMocks();
  aiWorkflowAPI.getModels.mockResolvedValue({
    data: { text: ['agnes-3.0-flash', 'agnes-2.5-flash'] },
  });
});

test('真实请求带当前画布、默认 Flash 和布尔联网设置，并自动应用结果', async () => {
  const props = baseProps();
  aiWorkflowAPI.generateWorkflow.mockResolvedValue({ data: result });
  renderAssistant(props);
  sendMessage('创建一个宣传文案流程');
  await waitFor(() => expect(props.onApply).toHaveBeenCalledWith(result));
  expect(aiWorkflowAPI.generateWorkflow.mock.calls[0][0]).toEqual({
    message: '创建一个宣传文案流程',
    messages: [],
    workflow: props.getWorkflow(),
    model: 'agnes-3.0-flash',
    search: false,
  });
  expect(aiWorkflowAPI.generateWorkflow.mock.calls[0][1].signal).toBeInstanceOf(
    AbortSignal
  );
  expect(
    await screen.findByText('已更新画布，可以继续编辑并保存。')
  ).toBeInTheDocument();
});

test('生成期间手动修改画布会保留候选，点击应用后才替换', async () => {
  let finish;
  let revision = 'old';
  aiWorkflowAPI.generateWorkflow.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const props = { ...baseProps(), getRevision: () => revision };
  renderAssistant(props);
  sendMessage('创建一个配图流程');
  revision = 'edited';
  await act(async () => finish({ data: result }));
  expect(props.onApply).not.toHaveBeenCalled();
  expect(
    screen.getByText('生成期间画布发生了修改，结果已保留。')
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '应用生成结果' }));
  expect(props.onApply).toHaveBeenCalledWith(result);
});

test('补充问题保持画布，重试携带前文且不会重复添加用户消息', async () => {
  const props = baseProps();
  aiWorkflowAPI.generateWorkflow
    .mockResolvedValueOnce({
      data: { reply: '希望生成哪一类内容？', workflow: null },
    })
    .mockRejectedValueOnce(new Error('生成暂时不可用'))
    .mockResolvedValueOnce({ data: result });
  renderAssistant(props);
  sendMessage('帮我创建一个工作流');
  await screen.findByText('希望生成哪一类内容？');
  expect(props.onApply).not.toHaveBeenCalled();
  sendMessage('生成文案和图片');
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '重新生成' }));
  await waitFor(() => expect(props.onApply).toHaveBeenCalledTimes(1));
  expect(aiWorkflowAPI.generateWorkflow.mock.calls[2][0].messages).toEqual([
    { role: 'user', content: '帮我创建一个工作流' },
    { role: 'assistant', content: '希望生成哪一类内容？' },
  ]);
  expect(screen.getAllByText('生成文案和图片')).toHaveLength(1);
});

test('StrictMode 首页首条需求只自动发送一次，停止后保持原画布', async () => {
  const props = baseProps();
  aiWorkflowAPI.generateWorkflow.mockImplementation(
    (payload, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () =>
          reject({ code: 'ERR_CANCELED' })
        );
      })
  );
  render(
    <StrictMode>
      <MemoryRouter>
        <WorkflowAssistant
          {...props}
          initialPrompt="创建文案流程"
          initialRequestKey="home-1"
        />
      </MemoryRouter>
    </StrictMode>
  );
  await waitFor(() =>
    expect(aiWorkflowAPI.generateWorkflow).toHaveBeenCalledTimes(1)
  );
  fireEvent.click(screen.getByRole('button', { name: '停止生成' }));
  await screen.findByText('已停止本次生成。');
  expect(props.onApply).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '生成工作流' })).toBeDisabled();
});
