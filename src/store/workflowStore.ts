import type { EdgeChange, NodeChange } from 'reactflow';
import type {
  GraphSnapshot,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowSource,
} from '../types/workflow';

import { create } from 'zustand';
import { isBaseNode, nodePorts } from '../utils/workflowNodes';
import {
  applyNodeChanges as applyFlowNodeChanges,
  applyEdgeChanges as applyFlowEdgeChanges,
} from 'reactflow';

export interface GraphChangeOptions {
  resetHistory?: boolean;
  recordHistory?: boolean;
  forceHistory?: boolean;
  clearSelection?: boolean;
  markClean?: boolean;
}
type WorkflowLoadOptions = { source?: WorkflowSource };
type CanvasWorkflow = Omit<Workflow, 'nodes'> & { nodes?: WorkflowNode[] };
type GraphUpdate =
  | Partial<GraphSnapshot>
  | ((graph: GraphSnapshot) => Partial<GraphSnapshot>);
type ValueUpdate<T> = T | ((value: T) => T);
type NodePatch = Omit<Partial<WorkflowNode>, 'data'> & {
  data?: Partial<WorkflowNodeData>;
};
type NodeUpdate = NodePatch | ((node: WorkflowNode) => NodePatch);

export interface WorkflowStore extends GraphSnapshot {
  currentWorkflow: Workflow | null;
  workflows: Workflow[];
  workflowSource: WorkflowSource;
  selectedNode: WorkflowNode | null;
  executionStatuses: Record<string, string>;
  setExecutionStatuses: (statuses: Record<string, string>) => void;
  isNodePanelOpen: boolean;
  isConfigPanelOpen: boolean;
  history: GraphSnapshot[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  savedGraphSignature: string;
  isDirty: boolean;
  setCurrentWorkflow: (
    workflow: Workflow | null,
    options?: WorkflowLoadOptions
  ) => void;
  setWorkflows: (workflows: Workflow[]) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  replaceGraph: (
    graph: Partial<GraphSnapshot>,
    options?: GraphChangeOptions
  ) => void;
  applyGraphChanges: (graph: GraphUpdate, options?: GraphChangeOptions) => void;
  setNodes: (
    nodes: ValueUpdate<WorkflowNode[]>,
    options?: GraphChangeOptions
  ) => void;
  setEdges: (
    edges: ValueUpdate<WorkflowEdge[]>,
    options?: GraphChangeOptions
  ) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, updates: NodeUpdate) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  deleteEdge: (id: string) => void;
  applyNodeChanges: (changes: NodeChange[]) => void;
  applyEdgeChanges: (changes: EdgeChange[]) => void;
  selectNode: (node: Pick<WorkflowNode, 'id'> | null) => void;
  toggleNodePanel: () => void;
  toggleConfigPanel: () => void;
  clearCanvas: () => void;
  loadWorkflow: (
    workflow: CanvasWorkflow | null,
    options?: WorkflowLoadOptions
  ) => void;
  markSaved: () => void;
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
}

const copy = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(copy) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, copy(item)])
    ) as T;
  return value;
};
const cleanNode = (node: WorkflowNode) => {
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
const signature = ({ nodes, edges }: GraphSnapshot) =>
  JSON.stringify({
    nodes: nodes.map(cleanNode),
    edges: edges.map(({ selected, ...edge }) => edge),
  });
const snapshot = (graph: GraphSnapshot): GraphSnapshot => ({
  nodes: copy(graph.nodes),
  edges: copy(graph.edges),
});
const emptyGraph = (): GraphSnapshot => ({ nodes: [], edges: [] });
const sourceOf = (
  workflow: Workflow | null,
  source?: WorkflowSource
): WorkflowSource =>
  source ||
  workflow?._source ||
  (workflow?.isLocal
    ? 'local'
    : workflow?.id || workflow?._id
      ? 'server'
      : 'new');

// 图的快照只在实际编辑后入栈，选中状态和画布测量不会产生撤销记录。
const changeGraph = (
  state: WorkflowStore,
  graph: Partial<GraphSnapshot>,
  options: GraphChangeOptions = {}
): Partial<WorkflowStore> => {
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
    (options.forceHistory === true ||
      signature(history[historyIndex]) !== graphKey)
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

const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  // 工作流定义与来源
  currentWorkflow: null,
  workflows: [],
  workflowSource: 'new',
  nodes: [],
  edges: [],
  selectedNode: null,
  executionStatuses: {},
  setExecutionStatuses: (executionStatuses) => set({ executionStatuses }),
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
    set((state) => {
      const nodes = state.nodes.map((node) => {
          if (node.id !== id) return node;
          const patch = typeof updates === 'function' ? updates(node) : updates;
          return {
            ...node,
            ...patch,
            data: patch.data ? { ...node.data, ...patch.data } : node.data,
          };
        });
      const updated = nodes.find(node => node.id === id);
      const ports = updated ? nodePorts(updated.data, 'outputs').map(port => port.name) : [];
      return changeGraph(state, { nodes, edges: state.edges.filter(edge => edge.source !== id || !edge.sourceHandle || ports.includes(edge.sourceHandle)) });
    }),
  deleteNode: (id) =>
    set((state) =>
      state.nodes.some(node => node.id === id && isBaseNode(node)) ? state : changeGraph(state, {
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
      changes = changes.filter(change => change.type !== 'remove' || !state.nodes.some(node => node.id === change.id && isBaseNode(node)));
      const nodes: WorkflowNode[] = applyFlowNodeChanges(
        changes,
        state.nodes
      ).map((node) =>
        node.type === undefined
          ? { ...node, type: 'custom' }
          : (node as WorkflowNode)
      );
      const removed = new Set(
        changes.flatMap((change) =>
          change.type === 'remove' ? [change.id] : []
        )
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
    set((state) => {
      const nodes = state.nodes.filter(isBaseNode);
      const edges = nodes.length === 2 ? [{ id: 'start-end', source: 'workflow-start', target: 'workflow-end', sourceHandle: 'main', targetHandle: 'main' }] : [];
      return changeGraph(state, { nodes, edges }, { clearSelection: true });
    }),
  loadWorkflow: (workflow, options = {}) => {
    if (!workflow) return;
    set((state) => ({
      executionStatuses: {},
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
