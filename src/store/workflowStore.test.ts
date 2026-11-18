import useWorkflowStore from './workflowStore';

const node = (id = 'node-1') => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  data: { type: 'llm', label: id, config: { prompt: '原始' } },
});
const state = () => useWorkflowStore.getState();
beforeEach(() =>
  useWorkflowStore.setState(useWorkflowStore.getInitialState(), true)
);

test('生成只改元数据时可显式记录一次历史，默认相同画布保持去重', () => {
  const graph = { nodes: [node()], edges: [] };
  state().loadWorkflow(graph);
  state().replaceGraph(graph);
  expect(state().history).toHaveLength(1);
  state().replaceGraph(graph, { forceHistory: true });
  expect(state().history).toHaveLength(2);
  expect(state().canUndo).toBe(true);
  state().undo();
  expect(state().nodes).toEqual(graph.nodes);
  expect(state().canRedo).toBe(true);
});

test('第一次编辑可以撤销到空画布，撤销后编辑会截断重做分支', () => {
  state().addNode(node());
  expect(state().canUndo).toBe(true);
  state().undo();
  expect(state().nodes).toEqual([]);
  expect(state().canRedo).toBe(true);
  state().redo();
  state().undo();
  state().addNode(node('new-node'));
  expect(state().canRedo).toBe(false);
  expect(state().nodes[0].id).toBe('new-node');
});

test('节点修改与撤销同步配置面板数据，节点删除同时移除连线并可撤销', () => {
  state().addNode(node());
  state().addNode(node('node-2'));
  state().addEdge({ id: 'edge-1', source: 'node-1', target: 'node-2' });
  state().selectNode(state().nodes[0]);
  state().updateNode('node-1', { data: { config: { prompt: '修改' } } });
  expect(state().selectedNode).toBe(state().nodes[0]);
  expect(state().selectedNode!.data.config.prompt).toBe('修改');
  state().undo();
  expect(state().selectedNode!.data.config.prompt).toBe('原始');
  state().applyNodeChanges([{ id: 'node-1', type: 'remove' }]);
  expect(state().selectedNode).toBeNull();
  expect(state().edges).toEqual([]);
  state().undo();
  expect(state().nodes).toHaveLength(2);
  expect(state().edges).toHaveLength(1);
});

test('拖拽只提交一次历史，选中和测量不改变脏状态', () => {
  state().addNode(node());
  state().markSaved();
  const count = state().history.length;
  state().applyNodeChanges([
    { type: 'select', id: 'node-1', selected: true },
    {
      type: 'dimensions',
      id: 'node-1',
      dimensions: { width: 200, height: 100 },
    },
  ]);
  expect(state().history).toHaveLength(count);
  expect(state().isDirty).toBe(false);
  state().applyNodeChanges([
    {
      type: 'position',
      id: 'node-1',
      position: { x: 50, y: 40 },
      dragging: true,
    },
  ]);
  expect(state().history).toHaveLength(count);
  expect(state().isDirty).toBe(true);
  state().applyNodeChanges([
    {
      type: 'position',
      id: 'node-1',
      position: { x: 50, y: 40 },
      dragging: false,
    },
  ]);
  expect(state().history).toHaveLength(count + 1);
  state().undo();
  expect(state().nodes[0].position).toEqual({ x: 0, y: 0 });
  expect(state().isDirty).toBe(false);
});

test('加载工作流重建历史与来源，重复同步不发出新状态', () => {
  const original = node();
  state().loadWorkflow(
    { id: 'local-1', nodes: [original], edges: [] },
    { source: 'local' }
  );
  expect(state().workflowSource).toBe('local');
  expect(state().canUndo).toBe(false);
  expect(state().isDirty).toBe(false);
  original.data.config.prompt = '外部修改';
  expect(state().nodes[0].data.config.prompt).toBe('原始');
  const listener = jest.fn();
  const dispose = useWorkflowStore.subscribe(listener);
  state().setNodes(JSON.parse(JSON.stringify(state().nodes)));
  expect(listener).not.toHaveBeenCalled();
  state().selectNode(state().nodes[0]);
  listener.mockClear();
  state().applyNodeChanges([]);
  expect(listener).not.toHaveBeenCalled();
  dispose();
});
