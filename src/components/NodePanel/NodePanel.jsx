import React, { useState, useEffect } from 'react';
import { nodeAPI } from '../../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../constants';
import './NodePanel.css';

const NodePanel = () => {
  const [nodeTypes, setNodeTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNodeTypes();
  }, []);

  const fetchNodeTypes = async () => {
    try {
      const response = await nodeAPI.getNodeTypes();
      setNodeTypes(response.data);
      
      // 默认展开所有分类
      const categories = {};
      response.data.forEach(node => {
        categories[node.category] = true;
      });
      setExpandedCategories(categories);
    } catch (error) {
      console.error('Failed to fetch node types:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const onDragStart = (event, node) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(node));
    event.dataTransfer.effectAllowed = 'move';
  };

  // 按分类组织节点
  const nodesByCategory = nodeTypes.reduce((acc, node) => {
    const category = node.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(node);
    return acc;
  }, {});

  // 过滤节点
  const filterNodes = (nodes) => {
    if (!searchTerm) return nodes;
    return nodes.filter(node => 
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (loading) {
    return (
      <div className="node-panel">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="node-panel">
      <div className="panel-header">
        <h3>节点面板</h3>
        <input
          type="text"
          placeholder="搜索节点..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="panel-content">
        {Object.entries(nodesByCategory).map(([category, nodes]) => {
          const filteredNodes = filterNodes(nodes);
          if (filteredNodes.length === 0) return null;

          return (
            <div key={category} className="category-section">
              <div 
                className="category-header"
                onClick={() => toggleCategory(category)}
              >
                <span className="category-icon">
                  {expandedCategories[category] ? '▼' : '▶'}
                </span>
                <span 
                  className="category-dot"
                  style={{ backgroundColor: CATEGORY_COLORS[category] }}
                />
                <span className="category-name">
                  {CATEGORY_LABELS[category] || category}
                </span>
                <span className="category-count">({filteredNodes.length})</span>
              </div>

              {expandedCategories[category] && (
                <div className="node-list">
                  {filteredNodes.map((node) => (
                    <div
                      key={node.type}
                      className="node-item"
                      draggable
                      onDragStart={(e) => onDragStart(e, node)}
                      style={{ borderLeftColor: CATEGORY_COLORS[category] }}
                    >
                      <div className="node-item-header">
                        {node.icon && <span className="node-item-icon">{node.icon}</span>}
                        <span className="node-item-name">{node.name}</span>
                      </div>
                      <div className="node-item-description">
                        {node.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="panel-footer">
        <div className="tip">💡 拖拽节点到画布</div>
      </div>
    </div>
  );
};

export default NodePanel;
