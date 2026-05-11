import React, { useState, useEffect } from 'react';
import useWorkflowStore from '../../store/workflowStore';
import { nodeAPI } from '../../services/api';
import './ConfigPanel.css';

const ConfigPanel = () => {
  const { selectedNode, updateNode, isConfigPanelOpen, toggleConfigPanel } = useWorkflowStore();
  const [nodeConfig, setNodeConfig] = useState({});
  const [nodeName, setNodeName] = useState('');
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedNode) {
      setNodeName(selectedNode.data?.label || '');
      setNodeConfig(selectedNode.data?.config || {});
      fetchNodeSchema(selectedNode.data?.type);
    }
  }, [selectedNode]);

  const fetchNodeSchema = async (nodeType) => {
    if (!nodeType) return;
    
    setLoading(true);
    try {
      const response = await nodeAPI.getNodeSchema(nodeType);
      setSchema(response.data);
    } catch (error) {
      console.error('Failed to fetch node schema:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (key, value) => {
    setNodeConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    if (!selectedNode) return;

    updateNode(selectedNode.id, {
      data: {
        ...selectedNode.data,
        label: nodeName,
        config: nodeConfig
      }
    });
  };

  const handleClose = () => {
    toggleConfigPanel();
  };

  const renderFormField = (key, propSchema) => {
    const value = nodeConfig[key] ?? propSchema.default ?? '';
    const isRequired = schema?.required?.includes(key);

    switch (propSchema.type) {
      case 'string':
        if (propSchema.format === 'textarea') {
          return (
            <textarea
              value={value}
              onChange={(e) => handleConfigChange(key, e.target.value)}
              placeholder={propSchema.description}
              rows={4}
              className="config-textarea"
            />
          );
        } else if (propSchema.enum) {
          return (
            <select
              value={value}
              onChange={(e) => handleConfigChange(key, e.target.value)}
              className="config-select"
            >
              <option value="">请选择</option>
              {propSchema.enum.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          );
        }
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleConfigChange(key, e.target.value)}
            placeholder={propSchema.description}
            className="config-input"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleConfigChange(key, parseFloat(e.target.value))}
            min={propSchema.minimum}
            max={propSchema.maximum}
            step={propSchema.type === 'integer' ? 1 : 0.1}
            placeholder={propSchema.description}
            className="config-input"
          />
        );

      case 'boolean':
        return (
          <label className="config-checkbox">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleConfigChange(key, e.target.checked)}
            />
            <span>{propSchema.description || key}</span>
          </label>
        );

      case 'array':
        return (
          <textarea
            value={Array.isArray(value) ? value.join('\n') : ''}
            onChange={(e) => handleConfigChange(key, e.target.value.split('\n').filter(v => v))}
            placeholder="每行一个值"
            rows={3}
            className="config-textarea"
          />
        );

      default:
        return (
          <input
            type="text"
            value={typeof value === 'object' ? JSON.stringify(value) : value}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleConfigChange(key, parsed);
              } catch {
                handleConfigChange(key, e.target.value);
              }
            }}
            placeholder={propSchema.description}
            className="config-input"
          />
        );
    }
  };

  if (!isConfigPanelOpen || !selectedNode) {
    return null;
  }

  return (
    <div className="config-panel">
      <div className="panel-header">
        <h3>节点配置</h3>
        <button onClick={handleClose} className="close-btn">✕</button>
      </div>

      <div className="panel-content">
        {/* 节点名称 */}
        <div className="config-section">
          <label className="config-label">节点名称</label>
          <input
            type="text"
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            placeholder="输入节点名称"
            className="config-input"
          />
        </div>

        {/* 节点类型 */}
        <div className="config-section">
          <label className="config-label">节点类型</label>
          <div className="config-readonly">{selectedNode.data?.type || '-'}</div>
        </div>

        {/* 配置表单 */}
        {loading ? (
          <div className="loading">加载配置...</div>
        ) : schema?.properties ? (
          <>
            <div className="config-divider" />
            <div className="config-section">
              <h4>配置参数</h4>
              {Object.entries(schema.properties).map(([key, propSchema]) => {
                const isRequired = schema.required?.includes(key);
                return (
                  <div key={key} className="config-field">
                    <label className="config-label">
                      {propSchema.title || key}
                      {isRequired && <span className="required">*</span>}
                    </label>
                    {propSchema.description && (
                      <div className="config-description">{propSchema.description}</div>
                    )}
                    {renderFormField(key, propSchema)}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-config">该节点无需配置</div>
        )}
      </div>

      <div className="panel-footer">
        <button onClick={handleSave} className="btn btn-primary">
          保存配置
        </button>
        <button onClick={handleClose} className="btn btn-default">
          取消
        </button>
      </div>
    </div>
  );
};

export default ConfigPanel;
