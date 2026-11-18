import type { IconType } from 'react-icons';
import type { NodeTypeMetadata } from '../../types/workflow';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FiSearch,
  FiChevronDown,
  FiPlus,
  FiType,
  FiImage,
  FiVideo,
  FiPlay,
  FiGlobe,
  FiDatabase,
  FiGitBranch,
  FiArrowUpRight,
  FiBox,
  FiX,
} from 'react-icons/fi';
import { nodeAPI } from '../../services/api';
import { CATEGORY_LABELS } from '../../constants';
import { DEFAULT_NODE_TYPES } from '../../constants/nodeTypes';
import useWorkflowStore from '../../store/workflowStore';
import './NodePanel.css';

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
const categoryOrder = [
  'trigger',
  'ai',
  'output',
  'integration',
  'logic',
  'other',
];

const NodePanel = ({
  onAddNode,
  disabled = false,
}: {
  onAddNode?: (node: NodeTypeMetadata) => void;
  disabled?: boolean;
}) => {
  const [nodeTypes, setNodeTypes] = useState(DEFAULT_NODE_TYPES);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState('loading');
  const toggleNodePanel = useWorkflowStore((state) => state.toggleNodePanel);

  useEffect(() => {
    let active = true;
    nodeAPI
      .getNodeTypes()
      .then((response) => {
        if (!active) return;
        if (response.data?.length) setNodeTypes(response.data);
        setSource('server');
      })
      .catch(() => {
        // 服务不可用时仍可用内置能力编排，运行时会显示实际连接错误。
        if (active) setSource('local');
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return categoryOrder
      .map((category) => ({
        category,
        nodes: nodeTypes
          .filter(
            (node) =>
              (node.category || 'other') === category &&
              `${node.name} ${node.description || ''} ${node.type}`
                .toLowerCase()
                .includes(query)
          )
          .sort(
            (left, right) =>
              Number(left.previewOnly || previewTypes.has(left.type)) -
              Number(right.previewOnly || previewTypes.has(right.type))
          ),
      }))
      .filter((group) => group.nodes.length);
  }, [nodeTypes, searchTerm]);

  const startDrag = (event: React.DragEvent<HTMLButtonElement>, node: NodeTypeMetadata) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/reactflow', JSON.stringify(node));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="node-panel" aria-label="节点库">
      <div className="node-library-header">
        <div>
          <span className="node-library-eyebrow">BUILDING BLOCKS</span>
          <h2>
            节点库 <span>{nodeTypes.length}</span>
          </h2>
        </div>
        <button
          className="node-library-close"
          onClick={toggleNodePanel}
          aria-label="收起节点库"
        >
          <FiX />
        </button>
      </div>
      <label className="node-library-search">
        <FiSearch />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="搜索节点或能力"
          aria-label="搜索节点"
        />
      </label>
      <div className="node-library-groups">
        {categories.map(({ category, nodes }) => (
          <section className="node-library-group" key={category}>
            <button
              className="node-library-category"
              aria-expanded={!collapsed[category]}
              onClick={() =>
                setCollapsed((previous) => ({
                  ...previous,
                  [category]: !previous[category],
                }))
              }
            >
              <FiChevronDown
                className={collapsed[category] ? 'is-collapsed' : ''}
              />
              <span>{CATEGORY_LABELS[category] || category}</span>
              <small>{nodes.length}</small>
            </button>
            {!collapsed[category] &&
              nodes.map((node) => {
                const Icon = icons[node.type] || FiBox;
                const preview =
                  node.previewOnly ||
                  node.executable === false ||
                  previewTypes.has(node.type);
                return (
                  <button
                    key={node.type}
                    className={`node-library-item ${preview ? 'preview-item' : ''}`}
                    data-node-type={node.type}
                    draggable={!disabled}
                    disabled={disabled}
                    onDragStart={(event) => startDrag(event, node)}
                    onClick={() => onAddNode?.(node)}
                    title={node.description}
                  >
                    <span className="node-library-item-icon">
                      <Icon />
                    </span>
                    <span className="node-library-item-content">
                      <strong>{node.name}</strong>
                      <small>{preview ? '仅模拟预览' : node.description}</small>
                    </span>
                    <FiPlus className="node-library-item-add" />
                  </button>
                );
              })}
          </section>
        ))}
        {!categories.length && (
          <div className="node-library-empty">没有找到匹配节点</div>
        )}
      </div>
      <div className="node-library-footer">
        <span className="node-library-flash">FLASH ONLY</span>
        <p>点击添加，或拖入画布</p>
        <small>
          {source === 'local'
            ? '内置节点库 · 离线编排'
            : source === 'loading'
              ? '正在同步节点能力…'
              : '已同步服务器能力'}
        </small>
      </div>
    </aside>
  );
};

export default NodePanel;
