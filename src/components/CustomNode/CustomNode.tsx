import type { NodeProps } from 'reactflow';
import type { WorkflowNodeData } from '../../types/workflow';
import React, { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import {
  FiTrash2,
  FiCheck,
  FiLoader,
} from 'react-icons/fi';
import useWorkflowStore from '../../store/workflowStore';
import { isBaseNode, nodePorts, portLabel } from '../../utils/workflowNodes';
import { CATEGORY_LABELS } from '../../constants';
import './CustomNode.css';
import { getNodeIcon } from '../../constants/nodeIcons';

const CustomNode = ({ id, data, selected }: NodeProps<WorkflowNodeData>) => {
  const {
    label,
    type,
    config = {},
  } = data;
  const status = useWorkflowStore(state => state.executionStatuses[id]) || data.status || 'idle';
  const Icon = getNodeIcon(type, data.category);
  const preview = data.previewOnly || data.executable === false;
  const inputs = nodePorts(data, 'inputs');
  const outputs = nodePorts(data, 'outputs');
  const portsKey = [...inputs, ...outputs].map(port => port.name).join('|');
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => { updateNodeInternals(id); }, [id, portsKey, updateNodeInternals]);
  const model = config.model === 'default' ? 'agnes-3.0-flash' : config.model;
  const summary =
    config.prompt ||
    config.query ||
    config.template ||
    config.expression ||
    config.url ||
    config.text ||
    config.value ||
    (config.workflowId ? `子流程 · ${String(config.workflowId)}` : '') ||
    (config.path ? `提取字段 · ${String(config.path)}` : '') ||
    data.description ||
    (type === 'manualTrigger'
      ? '由手动运行启动此工作流'
      : type === 'response'
        ? '整理并返回上游节点结果'
        : preview
          ? '可用于模拟预览'
          : '点击配置节点参数');

  return (
    <div
      className={`custom-node ${selected ? 'selected' : ''} ${preview ? 'preview-node' : ''} ${status}`}
    >
      {inputs.map((port, index) => (
        <Handle
          key={port.name}
          id={port.name}
          type="target"
          position={Position.Left}
          className="custom-handle"
          style={{ top: `${(index + 1) / (inputs.length + 1) * 100}%` }}
          title={portLabel(port)}
        />
      ))}
      <div className="custom-node-top">
        <span className={`custom-node-icon ${type} category-${data.category}`}>
          <Icon />
        </span>
        <div className="custom-node-identity">
          <span className="custom-node-label" title={label}>
            {label || '未命名节点'}
          </span>
          <span className="custom-node-type">{type}</span>
        </div>
        {!isBaseNode({ id, data }) && <button
          className="custom-node-delete nodrag nopan"
          aria-label={`删除节点 ${label || id}`}
          title="删除节点"
          onClick={(event) => {
            event.stopPropagation();
            useWorkflowStore.getState().deleteNode(id);
          }}
        >
          <FiTrash2 />
        </button>}
      </div>
      <div className="custom-node-description">
        {typeof summary === 'string' ? summary : JSON.stringify(summary)}
      </div>
      <div className="custom-node-footer">
        <span className={`custom-node-badge ${preview ? 'is-preview' : ''}`}>
          {preview
            ? '仅模拟预览'
            : model
              ? 'FLASH'
              : type.includes('Trigger')
                ? '触发器'
                : CATEGORY_LABELS[data.category || 'other'] || '处理节点'}
        </span>
        {Boolean(model) && (
          <span className="custom-node-model" title={typeof model === 'string' ? model : undefined}>
            {String(model).replace('agnes-', '')}
          </span>
        )}
        {status === 'running' && (
          <FiLoader className="custom-node-running" aria-label="运行中" />
        )}
        {status === 'success' && (
          <FiCheck className="custom-node-success" aria-label="已完成" />
        )}
      </div>
      {outputs.length === 1 && outputs[0].name === 'main' ? (
        <Handle
          id="main"
          type="source"
          position={Position.Right}
          className="custom-handle"
        />
      ) : outputs.length > 0 ? <div className="custom-node-ports">{outputs.map(port => <div className="custom-node-port" key={port.name}><span>{portLabel(port)}</span><Handle id={port.name} type="source" position={Position.Right} className="custom-handle" title={portLabel(port)} /></div>)}</div> : null}
    </div>
  );
};

export default memo(CustomNode);
