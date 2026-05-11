import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from '../CustomNode/CustomNode';
import useWorkflowStore from '../../store/workflowStore';
import './WorkflowCanvas.css';

const nodeTypes = {
  custom: CustomNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
  },
  style: {
    strokeWidth: 2,
  },
};

const WorkflowCanvas = () => {
  const { 
    nodes: storeNodes, 
    edges: storeEdges,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    selectNode,
    deleteNode,
    deleteEdge
  } = useWorkflowStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // 同步 store 中的节点和边到 ReactFlow
  useEffect(() => {
    setNodes(storeNodes);
    setEdges(storeEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  // 当节点或边改变时，更新 store
  useEffect(() => {
    setStoreNodes(nodes);
  }, [nodes, setStoreNodes]);

  useEffect(() => {
    setStoreEdges(edges);
  }, [edges, setStoreEdges]);

  // 连接节点
  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // 节点点击
  const onNodeClick = useCallback(
    (event, node) => {
      selectNode(node);
    },
    [selectNode]
  );

  // 画布点击（取消选择）
  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // 删除键处理
  const onNodesDelete = useCallback(
    (deleted) => {
      deleted.forEach((node) => deleteNode(node.id));
    },
    [deleteNode]
  );

  const onEdgesDelete = useCallback(
    (deleted) => {
      deleted.forEach((edge) => deleteEdge(edge.id));
    },
    [deleteEdge]
  );

  // 拖拽添加节点
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const nodeData = event.dataTransfer.getData('application/reactflow');
      if (!nodeData) return;

      const node = JSON.parse(nodeData);
      const position = reactFlowInstance.project({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node-${Date.now()}`,
        type: 'custom',
        position,
        data: {
          label: node.name,
          type: node.type,
          category: node.category,
          icon: node.icon,
          hasInput: node.inputs && node.inputs.length > 0,
          hasOutput: node.outputs && node.outputs.length > 0,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  return (
    <div className="workflow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid={true}
        snapGrid={[15, 15]}
        attributionPosition="bottom-right"
      >
        <Background color="#aaa" gap={15} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const color = node.data?.category 
              ? require('../../constants').CATEGORY_COLORS[node.data.category]
              : '#999';
            return color;
          }}
          style={{
            backgroundColor: '#f5f5f5',
          }}
        />
      </ReactFlow>
    </div>
  );
};

export default WorkflowCanvas;
