import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ConfigPanel from './ConfigPanel';
import { nodeAPI as actualNodeAPI } from '../../services/api';
import { DEFAULT_NODE_TYPES } from '../../constants/nodeTypes';
import { listKnowledgeBases as actualListKnowledgeBases } from '../../services/knowledgeApi';
import type {
  Parameters,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowEdge,
} from '../../types/workflow';

const nodeAPI = jest.mocked(actualNodeAPI);
const listKnowledgeBases = jest.mocked(actualListKnowledgeBases);

interface ConfigTestState {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  selectedNode: Pick<WorkflowNode, 'id' | 'data'>;
  isConfigPanelOpen: boolean;
  updateNode: jest.Mock<void, [string, { data: WorkflowNodeData }]>;
  toggleConfigPanel: jest.Mock<void, []>;
  saveHistory: jest.Mock<void, []>;
}

let mockState: ConfigTestState;

jest.mock('../../store/workflowStore', () => ({
  __esModule: true,
  default: () => mockState,
}));
jest.mock('../../services/api', () => ({
  nodeAPI: { getNodeSchema: jest.fn() },
}));
jest.mock('../../services/knowledgeApi', () => ({
  listKnowledgeBases: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  listKnowledgeBases.mockResolvedValue([]);
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
    code: 200,
    data: DEFAULT_NODE_TYPES.find((node) => node.type === 'llm')!.config_schema,
  });
});

function selectKnowledgeNode(config: Parameters = {}) {
  mockState.selectedNode = {
    id: 'knowledge-1',
    data: { type: 'knowledgeRetrieval', label: '资料检索', config },
  };
  nodeAPI.getNodeSchema.mockResolvedValue({
    code: 200,
    data: DEFAULT_NODE_TYPES.find((node) => node.type === 'knowledgeRetrieval')!
      .config_schema,
  });
}

test('知识库节点只能选择当前账号已启用的知识库并保存真实 ID', async () => {
  selectKnowledgeNode();
  listKnowledgeBases.mockResolvedValue([
    { id: 'mine', name: '产品手册', enabled: true },
    { id: 'disabled', name: '已关闭资料', enabled: false },
  ]);
  render(<ConfigPanel />);
  await screen.findByRole('option', { name: '产品手册' });
  expect(
    screen.queryByRole('option', { name: '已关闭资料' })
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '知识库' }), {
    target: { value: 'mine' },
  });
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(mockState.updateNode.mock.calls[0][1].data.config).toEqual({
    datasetId: 'mine',
    query: '{{input.question}}',
    topK: 3,
  });
});

test('已失效知识库不会作为可用 ID 保存，空列表提示创建资料', async () => {
  selectKnowledgeNode({ datasetId: 'foreign' });
  render(<ConfigPanel />);
  await screen.findByText('还没有已启用的知识库，请先在知识库中创建资料。');
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(mockState.updateNode).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    '请选择当前账号已启用的知识库'
  );
});

test('知识库加载失败可以重试，加载完成前禁止保存', async () => {
  selectKnowledgeNode();
  listKnowledgeBases.mockRejectedValueOnce(new Error('offline'));
  listKnowledgeBases.mockResolvedValueOnce([
    { id: 'mine', name: '产品手册', enabled: true },
  ]);
  render(<ConfigPanel />);
  expect(screen.getByRole('button', { name: '保存配置' })).toBeDisabled();
  fireEvent.click(
    await screen.findByRole('button', { name: '重试加载知识库' })
  );
  await screen.findByRole('option', { name: '产品手册' });
  expect(listKnowledgeBases).toHaveBeenCalledTimes(2);
  expect(mockState.updateNode).not.toHaveBeenCalled();
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

test('通用远程节点保留数字与布尔枚举的默认值和修改值', async () => {
  mockState.selectedNode = {
    id: 'custom-1',
    data: { type: 'custom', label: '自定义节点', config: {} },
  };
  nodeAPI.getNodeSchema.mockResolvedValue({
    code: 200,
    data: {
      properties: {
        level: { type: 'integer', title: '数字选项', enum: [1, 2], default: 1 },
        enabled: {
          type: 'boolean',
          title: '启用',
          enum: [false, true],
          default: false,
        },
      },
      required: [],
    },
  });
  render(<ConfigPanel />);
  const select = await screen.findByRole('combobox', { name: '数字选项' });
  expect(select).toHaveValue('1');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(mockState.updateNode.mock.calls[0][1].data.config).toEqual({
    level: 1,
    enabled: false,
  });
  fireEvent.change(select, { target: { value: '2' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(mockState.updateNode.mock.calls[1][1].data.config).toEqual({
    level: 2,
    enabled: true,
  });
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

test('参数映射可以提供必填输入，并将映射按独立字段保存', async () => {
  mockState.selectedNode.data.config = { prompt: '' };
  render(<ConfigPanel inputText='{"question":"测试问题"}' />);
  await screen.findByLabelText('提示词');
  fireEvent.change(screen.getByLabelText('输入映射 JSON'), { target: { value: '{"prompt":"{{input.question}}","search":false}' } });
  fireEvent.change(screen.getByLabelText('输出映射 JSON'), { target: { value: '{"answer":"text"}' } });
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  const saved = mockState.updateNode.mock.calls[0][1].data;
  expect(saved.inputMapping).toEqual({ prompt: '{{input.question}}', search: false });
  expect(saved.outputMapping).toEqual({ answer: 'text' });
});

test('结束节点可选择真正上游变量作为命名输出', async () => {
  mockState.selectedNode = { id: 'end', data: { type: 'response', label: '结束', config: { outputs: { answer: '' } } } };
  mockState.nodes = [{ id: 'model', type: 'custom', position: { x: 0, y: 0 }, data: { type: 'llm', label: '生成文本', config: {} } }];
  mockState.edges = [{ id: 'edge', source: 'model', target: 'end' }];
  nodeAPI.getNodeSchema.mockResolvedValue({ code: 200, data: DEFAULT_NODE_TYPES.find(node => node.type === 'response')!.config_schema });
  render(<ConfigPanel />);
  await screen.findByLabelText('answer 输出值');
  fireEvent.click(screen.getAllByRole('button', { name: '选择变量' })[0]);
  fireEvent.click(screen.getByRole('button', { name: /生成文本 · text nodes.model.output.text/ }));
  expect(screen.getByLabelText('answer 输出值')).toHaveValue('{{nodes.model.output.text}}');
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(mockState.updateNode.mock.calls[0][1].data.config.outputs).toEqual({ answer: '{{nodes.model.output.text}}' });
});

test('开始节点声明输入变量的数据类型和必填项', async () => {
  mockState.selectedNode = { id: 'workflow-start', data: { type: 'manualTrigger', label: '开始', config: {} } };
  nodeAPI.getNodeSchema.mockResolvedValue({ code: 200, data: DEFAULT_NODE_TYPES.find(node => node.type === 'manualTrigger')!.config_schema });
  render(<ConfigPanel inputText="{}" onInputChange={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '＋ 添加输入变量' }));
  fireEvent.change(screen.getByLabelText('input1 数据类型'), { target: { value: 'number' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(mockState.updateNode.mock.calls[0][1].data.config.inputSchema).toMatchObject({ type: 'object', properties: { input1: { type: 'number' } }, required: ['input1'] });
});

test('切回编辑器会刷新模型选项，保留未保存的节点设置', async () => {
  const schema = DEFAULT_NODE_TYPES.find(node => node.type === 'llm')!.config_schema;
  const customSchema = { ...schema, properties: { ...schema.properties,
    model: { ...schema.properties.model, enum: ['site-model'], default: 'site-model' } } };
  nodeAPI.getNodeSchema.mockResolvedValueOnce({ code: 200, data: schema });
  nodeAPI.getNodeSchema.mockResolvedValueOnce({ code: 200, data: customSchema });
  render(<ConfigPanel />);
  await screen.findByRole('option', { name: 'agnes-3.0-flash' });
  fireEvent.focus(window);
  await screen.findByRole('option', { name: 'site-model' });
  expect(screen.queryByRole('option', { name: 'agnes-2.5-flash' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: /模型/ }), { target: { value: 'site-model' } });
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(mockState.updateNode.mock.calls[0][1].data.config).toMatchObject({ model: 'site-model', prompt: '你好', temperature: 0 });
});
