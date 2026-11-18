import type { IconType } from 'react-icons';
import type { NodeProps } from 'reactflow';
import type { WorkflowNodeData } from '../../types/workflow';
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import {
  FiPlay,
  FiGlobe,
  FiType,
  FiImage,
  FiVideo,
  FiDatabase,
  FiGitBranch,
  FiArrowUpRight,
  FiBox,
  FiTrash2,
  FiCheck,
  FiLoader,
} from 'react-icons/fi';
import useWorkflowStore from '../../store/workflowStore';
import './CustomNode.css';

const icons: Record<string, IconType> = {
  manualTrigger: FiPlay,
  webhookTrigger: FiGlobe,
  llm: FiType,
  imageGeneration: FiImage,
  videoGeneration: FiVideo,
  knowledgeRetrieval: FiDatabase,
  httpRequest: FiGlobe,
  condition: FiGitBranch,
  response: FiArrowUpRight,
};
const previewTypes = new Set(['httpRequest', 'condition']);

const CustomNode = ({ id, data, selected }: NodeProps<WorkflowNodeData>) => {
  const {
    label,
    type,
    status = 'idle',
    hasInput = true,
    hasOutput = true,
    config = {},
  } = data;
  const Icon = icons[type] || FiBox;
  const preview = data.previewOnly || previewTypes.has(type);
  const model = config.model === 'default' ? 'agnes-3.0-flash' : config.model;
  const summary =
    config.prompt ||
    config.query ||
    config.template ||
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
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="custom-handle"
        />
      )}
      <div className="custom-node-top">
        <span className={`custom-node-icon ${type}`}>
          <Icon />
        </span>
        <div className="custom-node-identity">
          <span className="custom-node-label" title={label}>
            {label || '未命名节点'}
          </span>
          <span className="custom-node-type">{type}</span>
        </div>
        <button
          className="custom-node-delete nodrag nopan"
          aria-label={`删除节点 ${label || id}`}
          title="删除节点"
          onClick={(event) => {
            event.stopPropagation();
            useWorkflowStore.getState().deleteNode(id);
          }}
        >
          <FiTrash2 />
        </button>
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
                : '输出'}
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
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="custom-handle"
        />
      )}
    </div>
  );
};

export default memo(CustomNode);
