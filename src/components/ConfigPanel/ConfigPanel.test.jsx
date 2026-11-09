import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ConfigPanel from './ConfigPanel';
import { nodeAPI } from '../../services/api';
import { DEFAULT_NODE_TYPES } from '../../constants/nodeTypes';

let mockState;

jest.mock('../../store/workflowStore', () => ({
  __esModule: true,
  default: () => mockState,
}));
jest.mock('../../services/api', () => ({
  nodeAPI: { getNodeSchema: jest.fn() },
}));

beforeEach(() => {
  mockState = {
    selectedNode: {
      id: 'llm-1',
      data: {
        type: 'llm',
        label: '文本节点',
        config: { prompt: '你好', temperature: 0, search: false },
      },
    },
    isConfigPanelOpen: true,
    updateNode: jest.fn(),
    toggleConfigPanel: jest.fn(),
    saveHistory: jest.fn(),
  };
  nodeAPI.getNodeSchema.mockResolvedValue({
    data: DEFAULT_NODE_TYPES.find((node) => node.type === 'llm').config_schema,
  });
});

test('保存实际默认模型并保留温度 0 和关闭联网，空消息列表保持省略', async () => {
  render(<ConfigPanel />);
  await screen.findByLabelText('温度');
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  const saved = mockState.updateNode.mock.calls[0][1].data.config;
  expect(saved.model).toBe('agnes-3.0-flash');
  expect(saved.temperature).toBe(0);
  expect(saved.search).toBe(false);
  expect(saved).not.toHaveProperty('messages');
  expect(mockState.toggleConfigPanel).toHaveBeenCalledTimes(1);
});

test('无效 JSON 显示行内错误并阻止保存，修正后按消息数组保存', async () => {
  render(<ConfigPanel />);
  const messages = await screen.findByLabelText('自定义消息');
  fireEvent.change(messages, { target: { value: '{bad' } });
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(screen.getByRole('alert')).toHaveTextContent('JSON 格式有误');
  expect(mockState.updateNode).not.toHaveBeenCalled();
  fireEvent.change(messages, {
    target: { value: '[{"role":"user","content":"你好"}]' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(mockState.updateNode.mock.calls[0][1].data.config.messages).toEqual([
    { role: 'user', content: '你好' },
  ]);
});
