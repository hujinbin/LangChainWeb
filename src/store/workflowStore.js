import { create } from 'zustand';

const useWorkflowStore = create((set, get) => ({
  // 工作流定义
  currentWorkflow: null,
  workflows: [],
  
  // 画布状态
  nodes: [],
  edges: [],
  selectedNode: null,
  
  // UI 状态
  isNodePanelOpen: true,
  isConfigPanelOpen: false,
  
  // 操作历史（撤销/重做）
  history: [],
  historyIndex: -1,
  
  // 设置当前工作流
  setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),
  
  // 设置工作流列表
  setWorkflows: (workflows) => set({ workflows }),
  
  // 添加工作流
  addWorkflow: (workflow) => set((state) => ({
    workflows: [...state.workflows, workflow]
  })),
  
  // 更新工作流
  updateWorkflow: (id, updates) => set((state) => ({
    workflows: state.workflows.map(w => 
      w.id === id ? { ...w, ...updates } : w
    ),
    currentWorkflow: state.currentWorkflow?.id === id 
      ? { ...state.currentWorkflow, ...updates } 
      : state.currentWorkflow
  })),
  
  // 删除工作流
  deleteWorkflow: (id) => set((state) => ({
    workflows: state.workflows.filter(w => w.id !== id),
    currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow
  })),
  
  // 设置节点
  setNodes: (nodes) => set({ nodes }),
  
  // 添加节点
  addNode: (node) => set((state) => {
    const newNodes = [...state.nodes, node];
    return { nodes: newNodes };
  }),
  
  // 更新节点
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map(n => 
      n.id === id ? { ...n, ...updates } : n
    )
  })),
  
  // 删除节点
  deleteNode: (id) => set((state) => ({
    nodes: state.nodes.filter(n => n.id !== id),
    edges: state.edges.filter(e => e.source !== id && e.target !== id),
    selectedNode: state.selectedNode?.id === id ? null : state.selectedNode
  })),
  
  // 设置边
  setEdges: (edges) => set({ edges }),
  
  // 添加边
  addEdge: (edge) => set((state) => ({
    edges: [...state.edges, edge]
  })),
  
  // 删除边
  deleteEdge: (id) => set((state) => ({
    edges: state.edges.filter(e => e.id !== id)
  })),
  
  // 选择节点
  selectNode: (node) => set({ 
    selectedNode: node,
    isConfigPanelOpen: node !== null
  }),
  
  // 切换节点面板
  toggleNodePanel: () => set((state) => ({
    isNodePanelOpen: !state.isNodePanelOpen
  })),
  
  // 切换配置面板
  toggleConfigPanel: () => set((state) => ({
    isConfigPanelOpen: !state.isConfigPanelOpen
  })),
  
  // 清空画布
  clearCanvas: () => set({
    nodes: [],
    edges: [],
    selectedNode: null
  }),
  
  // 从工作流定义加载
  loadWorkflow: (workflow) => {
    if (!workflow) return;
    
    set({
      currentWorkflow: workflow,
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
      selectedNode: null
    });
  },
  
  // 保存历史记录（用于撤销/重做）
  saveHistory: () => set((state) => {
    const snapshot = {
      nodes: state.nodes,
      edges: state.edges
    };
    
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(snapshot);
    
    return {
      history: newHistory,
      historyIndex: newHistory.length - 1
    };
  }),
  
  // 撤销
  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    
    const prevIndex = state.historyIndex - 1;
    const snapshot = state.history[prevIndex];
    
    return {
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      historyIndex: prevIndex
    };
  }),
  
  // 重做
  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    
    const nextIndex = state.historyIndex + 1;
    const snapshot = state.history[nextIndex];
    
    return {
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      historyIndex: nextIndex
    };
  }),
}));

export default useWorkflowStore;
