import { create } from 'zustand';
import {
  applyNodeChanges as applyFlowNodeChanges,
  applyEdgeChanges as applyFlowEdgeChanges,
} from 'reactflow';

const copy = (value) => {
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, copy(item)])
    );
  return value;
};
const cleanNode = (node) => {
  const {
    selected,
    dragging,
    width,
    height,
    positionAbsolute,
    resizing,
    measured,
    ...saved
  } = node;
  return saved;
};
const signature = ({ nodes, edges }) =>
  JSON.stringify({
    nodes: nodes.map(cleanNode),
    edges: edges.map(({ selected, ...edge }) => edge),
  });
const snapshot = (graph) => ({
  nodes: copy(graph.nodes),
  edges: copy(graph.edges),
});
const emptyGraph = () => ({ nodes: [], edges: [] });
const sourceOf = (workflow, source) =>
  source ||
  workflow?._source ||
  (workflow?.isLocal
    ? 'local'
    : workflow?.id || workflow?._id
      ? 'server'
      : 'new');

// 图的快照只在实际编辑后入栈，选中状态和画布测量不会产生撤销记录。
const changeGraph = (state, graph, options = {}) => {
  const nodes = graph.nodes === undefined ? state.nodes : graph.nodes;
  const edges = graph.edges === undefined ? state.edges : graph.edges;
  const next = { nodes, edges };
  const graphKey = signature(next);
  let history = state.history;
  let historyIndex = state.historyIndex;
  if (options.resetHistory) {
    history = [snapshot(next)];
    historyIndex = 0;
  } else if (
    options.recordHistory !== false &&
    signature(history[historyIndex]) !== graphKey
  ) {
    history = [...history.slice(0, historyIndex + 1), snapshot(next)].slice(
      -100
    );
    historyIndex = history.length - 1;
  }
  const selectedNode = options.clearSelection
    ? null
    : nodes.find((node) => node.id === state.selectedNode?.id) || null;
  const savedGraphSignature = options.markClean
    ? graphKey
    : state.savedGraphSignature;
  const sameGraph =
    JSON.stringify(state.nodes) === JSON.stringify(nodes) &&
    JSON.stringify(state.edges) === JSON.stringify(edges);
  if (
    sameGraph &&
    history === state.history &&
    selectedNode === state.selectedNode &&
    savedGraphSignature === state.savedGraphSignature
  )
    return state;
  return {
    nodes,
    edges,
    selectedNode,
    isConfigPanelOpen: Boolean(selectedNode) && state.isConfigPanelOpen,
    history,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    savedGraphSignature,
    isDirty: graphKey !== savedGraphSignature,
  };
};

const useWorkflowStore = create((set, get) => ({
  // 工作流定义与来源
  currentWorkflow: null,
  workflows: [],
  workflowSource: 'new',
  nodes: [],
  edges: [],
  selectedNode: null,
  isNodePanelOpen: true,
  isConfigPanelOpen: false,
  history: [emptyGraph()],
  historyIndex: 0,
  canUndo: false,
  canRedo: false,
  savedGraphSignature: signature(emptyGraph()),
  isDirty: false,

  setCurrentWorkflow: (workflow, options = {}) =>
    set({
      currentWorkflow: workflow,
      workflowSource: sourceOf(workflow, options.source),
    }),
  setWorkflows: (workflows) => set({ workflows }),
  addWorkflow: (workflow) =>
    set((state) => ({ workflows: [...state.workflows, workflow] })),
  updateWorkflow: (id, updates) =>
    set((state) => ({
      workflows: state.workflows.map((workflow) =>
        workflow.id === id ? { ...workflow, ...updates } : workflow
      ),
      currentWorkflow:
        state.currentWorkflow?.id === id
          ? { ...state.currentWorkflow, ...updates }
          : state.currentWorkflow,
    })),
  deleteWorkflow: (id) =>
    set((state) => ({
      workflows: state.workflows.filter((workflow) => workflow.id !== id),
      currentWorkflow:
        state.currentWorkflow?.id === id ? null : state.currentWorkflow,
      workflowSource:
        state.currentWorkflow?.id === id ? 'new' : state.workflowSource,
    })),

  replaceGraph: (graph, options = {}) =>
    set((state) => changeGraph(state, graph, options)),
  applyGraphChanges: (graph, options = {}) =>
    set((state) =>
      changeGraph(
        state,
        typeof graph === 'function'
          ? graph({ nodes: state.nodes, edges: state.edges })
          : graph,
        options
      )
    ),
  setNodes: (nodes, options = {}) =>
    set((state) =>
      changeGraph(
        state,
        { nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes },
        options
      )
    ),
  setEdges: (edges, options = {}) =>
    set((state) =>
      changeGraph(
        state,
        { edges: typeof edges === 'function' ? edges(state.edges) : edges },
        options
      )
    ),
  addNode: (node) =>
    set((state) => changeGraph(state, { nodes: [...state.nodes, copy(node)] })),
  updateNode: (id, updates) =>
    set((state) =>
      changeGraph(state, {
        nodes: state.nodes.map((node) => {
          if (node.id !== id) return node;
          const patch = typeof updates === 'function' ? updates(node) : updates;
          return {
            ...node,
            ...patch,
            data: patch.data ? { ...node.data, ...patch.data } : node.data,
          };
        }),
      })
    ),
  deleteNode: (id) =>
    set((state) =>
      changeGraph(state, {
        nodes: state.nodes.filter((node) => node.id !== id),
        edges: state.edges.filter(
          (edge) => edge.source !== id && edge.target !== id
        ),
      })
    ),
  addEdge: (edge) =>
    set((state) => {
      if (
        state.edges.some(
          (item) =>
            item.id === edge.id ||
            (item.source === edge.source &&
              item.target === edge.target &&
              item.sourceHandle === edge.sourceHandle &&
              item.targetHandle === edge.targetHandle)
        )
      )
        return state;
      return changeGraph(state, { edges: [...state.edges, copy(edge)] });
    }),
  deleteEdge: (id) =>
    set((state) =>
      changeGraph(state, {
        edges: state.edges.filter((edge) => edge.id !== id),
      })
    ),

  applyNodeChanges: (changes) =>
    set((state) => {
      const nodes = applyFlowNodeChanges(changes, state.nodes);
      const removed = new Set(
        changes
          .filter((change) => change.type === 'remove')
          .map((change) => change.id)
      );
      const recordHistory = changes.some(
        (change) =>
          !['select', 'dimensions', 'position'].includes(change.type) ||
          (change.type === 'position' && change.dragging !== true)
      );
      return changeGraph(
        state,
        {
          nodes,
          edges: state.edges.filter(
            (edge) => !removed.has(edge.source) && !removed.has(edge.target)
          ),
        },
        { recordHistory }
      );
    }),
  applyEdgeChanges: (changes) =>
    set((state) =>
      changeGraph(
        state,
        {
          edges: applyFlowEdgeChanges(changes, state.edges),
        },
        { recordHistory: changes.some((change) => change.type !== 'select') }
      )
    ),

  // 配置面板始终指向画布里的当前节点，编辑和撤销后同步最新数据。
  selectNode: (node) =>
    set((state) => {
      const selectedNode = node
        ? state.nodes.find((item) => item.id === node.id) || null
        : null;
      return { selectedNode, isConfigPanelOpen: Boolean(selectedNode) };
    }),
  toggleNodePanel: () =>
    set((state) => ({ isNodePanelOpen: !state.isNodePanelOpen })),
  toggleConfigPanel: () =>
    set((state) => ({
      isConfigPanelOpen:
        !state.isConfigPanelOpen && Boolean(state.selectedNode),
    })),
  clearCanvas: () =>
    set((state) => changeGraph(state, emptyGraph(), { clearSelection: true })),
  loadWorkflow: (workflow, options = {}) => {
    if (!workflow) return;
    set((state) => ({
      ...changeGraph(
        state,
        {
          nodes: copy(workflow.nodes || []),
          edges: copy(workflow.edges || []),
        },
        { resetHistory: true, markClean: true, clearSelection: true }
      ),
      currentWorkflow: workflow,
      workflowSource: sourceOf(workflow, options.source),
    }));
  },
  markSaved: () =>
    set((state) => ({ savedGraphSignature: signature(state), isDirty: false })),
  saveHistory: () =>
    set((state) =>
      changeGraph(state, { nodes: state.nodes, edges: state.edges })
    ),
  undo: () => {
    const state = get();
    if (!state.canUndo) return;
    const historyIndex = state.historyIndex - 1;
    set({
      ...changeGraph(state, snapshot(state.history[historyIndex]), {
        recordHistory: false,
      }),
      historyIndex,
      canUndo: historyIndex > 0,
      canRedo: true,
    });
  },
  redo: () => {
    const state = get();
    if (!state.canRedo) return;
    const historyIndex = state.historyIndex + 1;
    set({
      ...changeGraph(state, snapshot(state.history[historyIndex]), {
        recordHistory: false,
      }),
      historyIndex,
      canUndo: true,
      canRedo: historyIndex < state.history.length - 1,
    });
  },
}));

export default useWorkflowStore;
