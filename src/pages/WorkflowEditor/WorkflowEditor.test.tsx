import type { WorkflowCanvasHandle } from '../../components/WorkflowCanvas/WorkflowCanvas';
import type { GenerateWorkflowResult } from '../../types/workflow';
import { normalizeModelCatalog } from '../../constants/nodeTypes';
import React, { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WorkflowEditor from './WorkflowEditor';
import useWorkflowStore from '../../store/workflowStore';
import { aiWorkflowAPI, workflowDefAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  aiWorkflowAPI: { getModels: jest.fn(), generateWorkflow: jest.fn() },
  workflowDefAPI: {
    createWorkflow: jest.fn(),
    updateWorkflow: jest.fn(),
    getWorkflow: jest.fn(),
  },
}));
jest.mock('../../components/NodePanel/NodePanel', () => () => (
  <aside>节点库</aside>
));
jest.mock('../../components/ConfigPanel/ConfigPanel', () => () => (
  <aside>节点配置</aside>
));
jest.mock('../../components/ExecutionResult/ExecutionResult', () => () => (
  <div>执行结果</div>
));
jest.mock('../../components/WorkflowCanvas/WorkflowCanvas', () => {
  const React: typeof import('react') = require('react');
  const useStore: typeof useWorkflowStore =
    require('../../store/workflowStore').default;
  return React.forwardRef<WorkflowCanvasHandle, { disabled?: boolean }>(
    (props, ref) => {
      const nodes = useStore((state) => state.nodes);
      React.useImperativeHandle(ref, () => ({
        fitView: jest.fn(),
        addNodeAtCenter: jest.fn(),
      }));
      return (
        <div data-testid="workflow-canvas">
          {nodes.map((node) => (
            <span key={node.id}>{node.data.label}</span>
          ))}
        </div>
      );
    }
  );
});

const mockAPI = jest.mocked(aiWorkflowAPI, true);
const mockWorkflowAPI = jest.mocked(workflowDefAPI, true);

const generated = {
  reply: '已生成产品文案工作流。',
  workflow: {
    name: '产品文案',
    description: '生成推广文案',
    nodes: [
      {
        id: 'start',
        type: 'manualTrigger',
        name: '开始',
        position: { x: 70, y: 70 },
        parameters: {},
      },
      {
        id: 'text',
        type: 'llm',
        name: '推广文案',
        position: { x: 370, y: 70 },
        parameters: {
          model: 'agnes-3.0-flash',
          prompt: '{{input.question}}',
          search: false,
          temperature: 0,
        },
      },
    ],
    edges: [{ id: 'start-text', source: 'start', target: 'text' }],
    variables: { brand: '咖啡店' },
    settings: { timeoutMs: 240000 },
  },
  input: { question: '写一段开业文案' },
  warnings: [],
} satisfies GenerateWorkflowResult;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  window.matchMedia = jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(() => false),
  }));
  useWorkflowStore
    .getState()
    .loadWorkflow({ nodes: [], edges: [] }, { source: 'new' });
  mockAPI.getModels.mockResolvedValue({
    code: 200,
    data: normalizeModelCatalog({
      text: ['agnes-3.0-flash', 'agnes-2.5-flash'],
    }),
  });
  mockAPI.generateWorkflow.mockResolvedValue({ code: 200, data: generated });
  mockWorkflowAPI.createWorkflow.mockResolvedValue({
    code: 200,
    data: { id: 'saved-1', validation: { valid: true, errors: [] } },
  });
  mockWorkflowAPI.updateWorkflow.mockResolvedValue({
    code: 200,
    data: { validation: { valid: true, errors: [] } },
  });
});

test('首页对话只生成一次，图和参数可撤销重做，保存使用正确新ID且继续对话保留手工修改', async () => {
  render(
    <StrictMode>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/workflows/new/edit',
            state: {
              initialPrompt: '创建产品文案流程',
              requestKey: 'initial-1',
            },
          },
        ]}
      >
        <Routes>
          <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );
  await waitFor(() =>
    expect(screen.getByLabelText('工作流名称')).toHaveValue('产品文案')
  );
  expect(aiWorkflowAPI.generateWorkflow).toHaveBeenCalledTimes(1);
  expect(useWorkflowStore.getState().nodes).toHaveLength(2);
  expect(useWorkflowStore.getState().isDirty).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '撤销' }));
  expect(screen.getByLabelText('工作流名称')).toHaveValue('未命名工作流');
  expect(useWorkflowStore.getState().nodes.map(node => node.id)).toEqual(['workflow-start', 'workflow-end']);
  fireEvent.click(screen.getByRole('button', { name: '重做' }));
  expect(screen.getByLabelText('工作流名称')).toHaveValue('产品文案');
  expect(useWorkflowStore.getState().nodes).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() =>
    expect(useWorkflowStore.getState().currentWorkflow?.id).toBe('saved-1')
  );
  expect(workflowDefAPI.getWorkflow).not.toHaveBeenCalled();
  expect(mockWorkflowAPI.createWorkflow.mock.calls[0][0]).toMatchObject({
    name: '产品文案',
    variables: { brand: '咖啡店' },
    settings: { timeoutMs: 240000 },
  });
  expect(screen.getByText('已生成产品文案工作流。')).toBeInTheDocument();
  await act(async () =>
    useWorkflowStore.getState().updateNode('text', {
      data: {
        config: { model: 'agnes-2.5-flash', prompt: '手工修改的提示词' },
      },
    })
  );
  fireEvent.change(screen.getByRole('textbox', { name: '继续描述修改要求' }), {
    target: { value: '保留文案，再补充配图' },
  });
  fireEvent.click(screen.getByRole('button', { name: '生成工作流' }));
  await waitFor(() =>
    expect(aiWorkflowAPI.generateWorkflow).toHaveBeenCalledTimes(2)
  );
  const nextRequest = mockAPI.generateWorkflow.mock.calls[1][0];
  expect(nextRequest.workflow?.nodes?.[1].parameters?.prompt).toBe(
    '手工修改的提示词'
  );
  expect(nextRequest.workflow?.input).toEqual({ question: '写一段开业文案' });
  expect(nextRequest.messages).toHaveLength(2);
});

test('对话只修改名称也可撤销，既有工作流的ID和服务端来源保留', async () => {
  const existing = {
    ...generated.workflow,
    id: 'existing-1',
    edges: generated.workflow.edges.map((edge) => ({
      ...edge,
      type: 'smoothstep',
    })),
  };
  mockWorkflowAPI.getWorkflow.mockResolvedValue({ code: 200, data: existing });
  mockAPI.generateWorkflow.mockResolvedValue({
    code: 200,
    data: { ...generated, workflow: { ...existing, name: '改名后的流程' } },
  });
  render(
    <MemoryRouter initialEntries={['/workflows/existing-1/edit']}>
      <Routes>
        <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() =>
    expect(screen.getByLabelText('工作流名称')).toHaveValue('产品文案')
  );
  fireEvent.click(screen.getByRole('button', { name: '对话生成' }));
  fireEvent.change(screen.getByRole('textbox', { name: '工作流需求' }), {
    target: { value: '将名称改为改名后的流程' },
  });
  fireEvent.click(screen.getByRole('button', { name: '生成工作流' }));
  await waitFor(() =>
    expect(screen.getByLabelText('工作流名称')).toHaveValue('改名后的流程')
  );
  expect(useWorkflowStore.getState().currentWorkflow?.id).toBe('existing-1');
  expect(useWorkflowStore.getState().workflowSource).toBe('server');
  fireEvent.click(screen.getByRole('button', { name: '撤销' }));
  expect(screen.getByLabelText('工作流名称')).toHaveValue('产品文案');
  fireEvent.click(screen.getByRole('button', { name: '重做' }));
  expect(screen.getByLabelText('工作流名称')).toHaveValue('改名后的流程');
});

test('新建默认含唯一开始结束，保存重开保留映射且不会重复补节点', async () => {
  const view = render(<MemoryRouter initialEntries={['/workflows/new/edit']}><Routes><Route path="/workflows/:id/edit" element={<WorkflowEditor />} /></Routes></MemoryRouter>);
  await waitFor(() => expect(useWorkflowStore.getState().nodes.map(node => node.id)).toEqual(['workflow-start', 'workflow-end']));
  expect(useWorkflowStore.getState().edges).toHaveLength(1);
  await act(async () => useWorkflowStore.getState().updateNode('workflow-end', { data: { inputMapping: { template: '{{input}}' }, outputMapping: { answer: 'result' } } }));
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(mockWorkflowAPI.createWorkflow).toHaveBeenCalledTimes(1));
  const saved = mockWorkflowAPI.createWorkflow.mock.calls[0][0];
  expect(saved.nodes?.find(node => node.id === 'workflow-end')).toMatchObject({ inputMapping: { template: '{{input}}' }, outputMapping: { answer: 'result' } });
  view.unmount();
  mockWorkflowAPI.getWorkflow.mockResolvedValue({ code: 200, data: { ...saved, id: 'reopened' } });
  render(<MemoryRouter initialEntries={['/workflows/reopened/edit']}><Routes><Route path="/workflows/:id/edit" element={<WorkflowEditor />} /></Routes></MemoryRouter>);
  await waitFor(() => expect(useWorkflowStore.getState().currentWorkflow?.id).toBe('reopened'));
  expect(useWorkflowStore.getState().nodes.map(node => node.id)).toEqual(['workflow-start', 'workflow-end']);
  expect(useWorkflowStore.getState().nodes[1].data.outputMapping).toEqual({ answer: 'result' });
});
