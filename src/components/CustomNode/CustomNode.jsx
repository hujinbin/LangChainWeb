import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { CATEGORY_COLORS, NODE_STATUS } from '../../constants';
import './CustomNode.css';

const CustomNode = ({ data, selected }) => {
  const { 
    label, 
    type, 
    category, 
    icon, 
    status = NODE_STATUS.IDLE,
    hasInput = true,
    hasOutput = true
  } = data;

  const getStatusIcon = () => {
    switch (status) {
      case NODE_STATUS.RUNNING:
        return <span className="status-icon running">⟳</span>;
      case NODE_STATUS.SUCCESS:
        return <span className="status-icon success">✓</span>;
      case NODE_STATUS.ERROR:
        return <span className="status-icon error">✗</span>;
      default:
        return null;
    }
  };

  const nodeColor = CATEGORY_COLORS[category] || '#999';

  return (
    <div 
      className={`custom-node ${selected ? 'selected' : ''} ${status}`}
      style={{ borderColor: nodeColor }}
    >
      {hasInput && (
        <Handle 
          type="target" 
          position={Position.Left}
          className="custom-handle"
        />
      )}
      
      <div className="node-header" style={{ backgroundColor: nodeColor }}>
        {icon && <span className="node-icon">{icon}</span>}
        <span className="node-type">{type}</span>
      </div>
      
      <div className="node-body">
        <div className="node-label">{label || '未命名节点'}</div>
        {getStatusIcon()}
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
