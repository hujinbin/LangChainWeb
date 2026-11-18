import type {
  Connection,
  DefaultEdgeOptions,
  ReactFlowInstance,
  XYPosition,
} from 'reactflow';
import type {
  NodeTypeMetadata,
  WorkflowNode,
  WorkflowNodeData,
} from '../../types/workflow';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  MarkerType,
} from 'reactflow';
import { FiGitBranch, FiPlus } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import 'reactflow/dist/style.css';
import CustomNode from '../CustomNode/CustomNode';
import useWorkflowStore from '../../store/workflowStore';
import {
  DEFAULT_NODE_TYPES,
  getDefaultParameters,
  mergeNodeTypes,
} from '../../constants/nodeTypes';
import './WorkflowCanvas.css';

export interface WorkflowCanvasHandle {
  addNodeAtCenter: (metadata: NodeTypeMetadata | undefined) => void;
  fitView: () => void;
}

interface WorkflowCanvasProps {
  disabled?: boolean;
}

const nodeTypes = { custom: CustomNode };
const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#779487' },
  style: { strokeWidth: 1.6, stroke: '#779487' },
};

const WorkflowCanvas = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(({ disabled = false }, ref) => {
  const {
    nodes,
    edges,
    applyNodeChanges,
    applyEdgeChanges,
    addNode,
    addEdge,
    selectNode,
    toggleNodePanel,
    isNodePanelOpen,
  } = useWorkflowStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<
    ReactFlowInstance<WorkflowNodeData, Record<string, unknown>> | null
  >(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previousWidth = 0;
    let previousHeight = 0;
    // 只响应容器尺寸变化，结果抽屉和配置面板展开时重新适配节点。
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (
        width <= 0 ||
        height <= 0 ||
        (width === previousWidth && height === previousHeight)
      )
        return;
      previousWidth = width;
      previousHeight = height;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (useWorkflowStore.getState().nodes.length)
          flowRef.current?.fitView({
            padding: 0.25,
            maxZoom: 1,
            duration: 120,
          });
      }, 80);
    });
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const addAtScreen = useCallback(
    (meta: NodeTypeMetadata | undefined, point: XYPosition, avoidOverlap = false) => {
      if (disabled || !meta?.type) return;
      const center = flowRef.current?.screenToFlowPosition(point) || {
        x: 220,
        y: 160,
      };
      const position = { x: center.x - 112, y: center.y - 60 };
      if (avoidOverlap) {
        const existing = useWorkflowStore.getState().nodes;
        while (
          existing.some(
            (node) =>
              Math.abs(node.position.x - position.x) < 250 &&
              Math.abs(node.position.y - position.y) < 150
          )
        ) {
          position.x += 280;
        }
      }
      const node: WorkflowNode = {
        id: `node-${uuidv4()}`,
        type: 'custom',
        position,
        data: {
          label: meta.name || meta.type,
          type: meta.type,
          category: meta.category || 'other',
          icon: meta.icon,
          hasInput: Boolean(meta.inputs?.length),
          hasOutput: Boolean(meta.outputs?.length),
          previewOnly: meta.previewOnly || meta.executable === false,
          config: getDefaultParameters(meta),
        },
      };
      addNode(node);
      selectNode(node);
      if (avoidOverlap)
        flowRef.current?.setCenter(position.x + 112, position.y + 60, {
          zoom: flowRef.current.getZoom(),
          duration: 160,
        });
    },
    [addNode, disabled, selectNode]
  );

  const addAtCenter = useCallback(
    (meta: NodeTypeMetadata | undefined) => {
      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (bounds)
        addAtScreen(
          meta,
          {
            x: bounds.left + bounds.width / 2,
            y: bounds.top + bounds.height * 0.42,
          },
          true
        );
    },
    [addAtScreen]
  );

  useImperativeHandle(
    ref,
    () => ({
      addNodeAtCenter: addAtCenter,
      fitView: () =>
        flowRef.current?.fitView({ padding: 0.25, maxZoom: 1, duration: 150 }),
    }),
    [addAtCenter]
  );

  const isValidConnection = useCallback(
    (connection: Connection) =>
      Boolean(
        connection.source &&
        connection.target &&
        connection.source !== connection.target &&
        !edges.some(
          (edge) =>
            edge.source === connection.source &&
            edge.target === connection.target &&
            (edge.sourceHandle || null) === (connection.sourceHandle || null) &&
            (edge.targetHandle || null) === (connection.targetHandle || null)
        )
      ),
    [edges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!disabled && isValidConnection(connection) && connection.source && connection.target) {
        addEdge({
          ...connection,
          source: connection.source,
          target: connection.target,
          id: `edge-${uuidv4()}`,
          type: 'smoothstep',
        });
      }
    },
    [addEdge, disabled, isValidConnection]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      try {
        const raw = event.dataTransfer.getData('application/reactflow');
        if (raw) {
          const value: unknown = JSON.parse(raw);
          if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') return;
          const metadata = mergeNodeTypes([value]).find((item) => item.type === value.type);
          if (metadata) addAtScreen(metadata, { x: event.clientX, y: event.clientY });
        }
      } catch {
        // 非节点拖放内容不进入工作流，避免破坏当前画布。
      }
    },
    [addAtScreen]
  );

  return (
    <div className="workflow-canvas" ref={wrapperRef} aria-label="工作流画布">
      {/* 画布直接消费 store，避免本地状态与 store 的双向同步循环。 */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={applyNodeChanges}
        onEdgesChange={applyEdgeChanges}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_, node) => selectNode(node)}
        onPaneClick={() => selectNode(null)}
        onInit={(instance) => {
          flowRef.current = instance;
        }}
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={!disabled}
        nodesConnectable={!disabled}
        deleteKeyCode={disabled ? null : ['Backspace', 'Delete']}
        minZoom={0.25}
        maxZoom={1.8}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        snapToGrid
        snapGrid={[16, 16]}
        attributionPosition="bottom-right"
      >
        <Background color="#cfd9cd" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor="#bad0bc"
          maskColor="rgba(235, 241, 231, 0.7)"
          pannable
          zoomable
        />
      </ReactFlow>
      <div className="canvas-counter">
        <span />
        {nodes.length} 个节点
        <span className="canvas-counter-divider" />
        {edges.length} 条连接
      </div>
      {!nodes.length && (
        <div className="canvas-empty">
          <span className="canvas-empty-symbol">
            <FiGitBranch />
          </span>
          <span className="canvas-empty-eyebrow">BUILD YOUR FLOW</span>
          <h2>从一个触发节点开始</h2>
          <p>连接 Flash 模型，让文字、图片和视频有序生成。</p>
          <button
            className="btn btn-primary"
            disabled={disabled}
            onClick={() =>
              addAtCenter(
                DEFAULT_NODE_TYPES.find((node) => node.type === 'manualTrigger')
              )
            }
          >
            <FiPlus /> 添加手动触发
          </button>
          {!isNodePanelOpen && (
            <button className="canvas-open-library" onClick={toggleNodePanel}>
              浏览节点库
            </button>
          )}
        </div>
      )}
      <div className="canvas-help">
        拖动画布浏览 <span>·</span> 滚轮缩放 <span>·</span> Delete 删除选中项
      </div>
    </div>
  );
});

export default WorkflowCanvas;
